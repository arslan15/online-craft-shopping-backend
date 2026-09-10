const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../model/Order');
const Product = require('../model/Product');
const User = require('../model/User');
const { verifyToken, authorize } = require('../middleware/authMiddleware');

router.post('/place-order', verifyToken,
  authorize(['user']),async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { cart, shippingAddress, totalAmount, user, customerEmail } = req.body;
     console.log("Incoming Payload : " +" "+req.body.user);
    // 1. Basic Payload Validation
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ message: 'Cart items are required.' });
    }

    if (!shippingAddress || !totalAmount) {
      return res.status(400).json({ message: 'Shipping address and total amount are required.' });
    }

    // 2. Stock Verification & Inventory Reduction
    for (const item of cart) {
      const productId = item.product || item._id || item.id;
      const product = await Product.findById(productId).session(session);

      if (!product) {
        throw new Error(`Product with ID ${productId} not found.`);
      }

      if (product.ProductQty < (item.quantity || 1)) {
        throw new Error(`Insufficient stock for product: ${product.productName}`);
      }

      product.ProductQty -= (item.quantity || 1);
      await product.save({ session });
    }

    // 3. Save Order Document
    const newOrder = new Order({
      user: user || null,
      cart: cart.map((item) => ({
        product: item.product || item._id || item.id,
        productName: item.productName || item.title || item.productTitle,
        quantity: item.quantity || item.qty || 1,
        price: item.price,
      })),
      shippingAddress,
      totalAmount,
    });

    const savedOrder = await newOrder.save({ session });

    // Commit Transaction before handling asynchronous side-effects (emails)
    await session.commitTransaction();
    session.endSession();

    // 4. Send Email Notifications (Customer + Admin Users)
    /*const enteredUserEmail = shippingAddress.email || customerEmail;

    if (enteredUserEmail) {
      // Build HTML list of ordered items
      const itemsList = cart
        .map(
          (item) =>
            `<li>${item.productName || item.title || 'Item'} x ${item.quantity || 1} - Rs. ${item.price}</li>`
        )
        .join('');

      // A. Template for the Entered Customer Email
      const customerMailOptions = {
        from: `"E-Store" <${process.env.EMAIL_USER}>`,
        to: enteredUserEmail,
        subject: `Order Confirmation - #${savedOrder._id}`,
        html: `
          <h2>Thank you for your order!</h2>
          <p>Your order ID is: <strong>${savedOrder._id}</strong></p>
          <h3>Order Summary:</h3>
          <ul>${itemsList}</ul>
          <p><strong>Total Amount:</strong> Rs. ${totalAmount}</p>
          <h3>Shipping Address:</h3>
          <p>
            ${shippingAddress.fullName}<br/>
            ${shippingAddress.address}, ${shippingAddress.city}<br/>
            Phone: ${shippingAddress.phone}
          </p>
        `,
      };

      // B. Fetch All Registered Admin Emails from Database
      const adminUsers = await User.find({ role: 'admin' }, 'email');
      const adminEmails = adminUsers.map((admin) => admin.email);

      // Fallback to process.env.ADMIN_EMAIL if no admin documents match in DB
      if (adminEmails.length === 0 && process.env.ADMIN_EMAIL) {
        adminEmails.push(process.env.ADMIN_EMAIL);
      }

      const emailPromises = [transporter.sendMail(customerMailOptions)];

      // C. Template for Admin Team
      if (adminEmails.length > 0) {
        const adminMailOptions = {
          from: `"E-Store System" <${process.env.EMAIL_USER}>`,
          to: adminEmails,
          subject: `🚨 New Order Received - #${savedOrder._id}`,
          html: `
            <h2>New Order Placed!</h2>
            <p><strong>Order ID:</strong> ${savedOrder._id}</p>
            <p><strong>Customer:</strong> ${shippingAddress.fullName} (${enteredUserEmail})</p>
            <p><strong>Total Amount:</strong> Rs. ${totalAmount}</p>
            <h3>Purchased Items:</h3>
            <ul>${itemsList}</ul>
          `,
        };
        emailPromises.push(transporter.sendMail(adminMailOptions));
      }

      // Execute email sends asynchronously (non-blocking)
      Promise.all(emailPromises).catch((emailErr) => {
        console.error('Failed to send order email notifications:', emailErr);
      });
    }*/

    return res.status(201).json({
      message: 'Order placed successfully!',
      orderId: savedOrder._id,
      order: savedOrder,
    });

  } catch (error) {
    // Abort transaction on failure to rollback product stock updates
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ 
      message: error.message || 'Failed to place order.' 
    });
  }
});
// -----------------------------------------------------------------------------
// 1. GET ALL ORDERS (Used by Admin Dashboard)
// Route: GET /api/orders
// -----------------------------------------------------------------------------
router.get('/orders', verifyToken, authorize(['Admin']), async (req, res) => {
  try {
    // 1. Extract and sanitize page and limit from query params
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const skip = (page - 1) * limit;

    // 2. Fetch total count and paginated items concurrently
    const [orders, totalOrders] = await Promise.all([
      Order.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(),
    ]);

    const totalPages = Math.ceil(totalOrders / limit) || 1;

    // 3. Return payload formatted for frontend consumption
    return res.status(200).json({
      orders,
      pagination: {
        totalOrders,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({ message: 'Failed to retrieve orders.' });
  }
});

module.exports = router;