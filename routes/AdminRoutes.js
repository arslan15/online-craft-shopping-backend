const express = require('express');
const Category = require('../model/Category');
const Order = require('../model/Order');
const mongoose = require('mongoose');
const router = express.Router();
const { verifyToken, authorize } = require('../middleware/authMiddleware');

router.put('/settings', verifyToken, authorize (['Admin']),async (req, res) => {
  try {

    const { maintenanceMode, userRegistration,userLogin } = req.body;
console.log('--- 1. SETTINGS ENDPOINT HIT ---');
  console.log('Incoming Payload:', req.body);
    const updatedSettings = await SystemSettings.findOneAndUpdate(
      {},
      {
        $set: {
          maintenanceMode,
          userRegistration,
          userLogin,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true, // Forces Mongoose schema defaults during upsert
      }
    );
console.log('Updatesettings', updatedSettings);
    res.status(200).json({
      message: 'Settings saved successfully!',
      settings: updatedSettings,
    });
  } catch (error) {
    console.error('UPDATE SETTINGS ERROR:', error);
    res.status(500).json({ message: 'Failed to save settings.', error: error.message });
  }
});
router.get('/settings', verifyToken, authorize (['Admin']), async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      // Create defaults in DB if no record exists yet
      settings = await SystemSettings.create({
        maintenanceMode: false,
        userRegistration: true,
        sessionTimeout: 60,
      });
    }
    console.log(settings);
    res.status(200).json(settings);
  } catch (error) {
    console.error('GET SETTINGS ERROR:', error.message);
    res.status(500).json({ message: 'Failed to fetch settings.' });
  }
});
router.post('/addCategory', verifyToken, authorize (['Admin']), async(req,res)=>{
  try {
  
    console.log('1. Register endpoint hit with body:', req.body);
    const { categoryType,categoryDescription} = req.body;
   

    const newCategory = new Category({categoryType,categoryDescription});
    await newCategory.save();
    
    res.status(201).json({ message: 'Category created successfully!' });
  } catch (error) {
    console.error('REGISTER CATCH ERROR:', error.message);
  
    res.status(500).json({ message: 'Server error during registration.' });

  }
})
router.get('/categories',verifyToken, authorize (['Admin']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    // Read limit from query parameters (defaults to 10)
    let limit = parseInt(req.query.limit) || 10;
    // Safety cap: max 100 items per request
    if (limit > 100) limit = 100;
    const skip = (page - 1) * limit;

    const [Categories, totalCategories] = await Promise.all([
          Category.find().skip(skip).limit(limit),
          Category.countDocuments()
        ]);

   const totalPages = Math.ceil(totalCategories / limit) || 1;
    res.status(200).json({
    success: true,
    data: Categories,
    pagination: {
    currentPage: page,
    totalPages,
    totalItems: totalCategories,
    limit
    }
   });
  } catch (error) {
    console.error('GET CATEGORIES ERROR:', error.message);
    res.status(500).json({ message: 'Server error fetching categories.' });
  }
});
router.patch('/order/approval', verifyToken, authorize (['Admin']), async (req, res) => {
  try {
    const { orderId, status } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ message: 'Order ID and status are required.' });
    }

    // Extract raw string ID if passed inside an object
    const rawId = typeof orderId === 'object' && orderId.$oid ? orderId.$oid : orderId;

    // Convert string to Mongoose ObjectId safely
    let targetId;
    if (mongoose.Types.ObjectId.isValid(rawId)) {
      targetId = new mongoose.Types.ObjectId(rawId);
    } else {
      targetId = rawId;
    }

    // Perform database update on paymentStatus
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: targetId },
      { 
        $set: { 
          paymentStatus: status,
          ...(status === 'Paid' && { orderStatus: 'Paid' }),
          ...(status === 'Failed' && { orderStatus: 'Cancelled' })
        } 
      },
      { new: true, runValidators: true }
    );

    if (!updatedOrder) {
      console.log(`Failed to locate order in DB for ID: ${rawId}`);
      return res.status(404).json({ message: 'Order document not found in DB.' });
    }

    console.log(`Successfully updated MongoDB paymentStatus to '${status}' for order ${rawId}`);
    return res.status(200).json({
      message: 'Payment status updated in database.',
      order: updatedOrder,
    });
  } catch (error) {
    console.error('Database update error:', error);
    return res.status(500).json({ message: error.message || 'Server error updating DB.' });
  }
});
module.exports = router; 