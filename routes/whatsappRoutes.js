const express = require('express');
const router = express.Router();
const Product = require('../model/Product'); // Update path to your Product model if needed
const Order = require('../model/Order');     // Update path to your Order model if needed
const axios = require('axios');

// In-memory conversation state map (Store in Redis/DB for production apps)
const conversationStates = new Map();

// Helper function to send WhatsApp messages
async function sendWhatsAppMessage(recipientPhone, messageData) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  await axios({
    method: 'POST',
    url: `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      messaging_product: 'whatsapp',
      to: recipientPhone,
      ...messageData,
    },
  });
}

// Helper function to send the product list catalog menu
async function sendProductListMenu(recipientPhone) {
  const products = await Product.find({ ProductQty: { $gt: 0 } }).limit(10).lean();

  if (!products || products.length === 0) {
    await sendWhatsAppMessage(recipientPhone, {
      type: 'text',
      text: { body: 'Sorry, there are no products available right now.' }
    });
    return;
  }

  const rows = products.map((prod) => ({
    id: prod._id.toString(), // Pass the MongoDB _id as the list row ID
    title: prod.productName.substring(0, 24), // WhatsApp title limit is 24 chars
    description: `PKR ${prod.price} - Stock: ${prod.ProductQty}`
  }));

  const listMessage = {
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: 'Our Catalog' },
      body: { text: 'Please select an item from our catalog below:' },
      footer: { text: 'Tap "View Items" to browse' },
      action: {
        button: 'View Items',
        sections: [
          {
            title: 'Available Products',
            rows: rows
          }
        ]
      }
    }
  };

  await sendWhatsAppMessage(recipientPhone, listMessage);
}

// Main Webhook Route
router.post('/webhook/whatsapp', async (req, res) => {
  res.status(200).send('Event Received');
  
  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    
    const messageEntry = value?.messages?.[0];
    if (!messageEntry) return;

    const customerPhone = messageEntry.from;
    const currentState = conversationStates.get(customerPhone);


    // ==========================================
    // 1. Handle Text Messages
    // ==========================================
    if (messageEntry.type === 'text') {
      const messageText = messageEntry.text.body.trim().toLowerCase();

      // Check if user wants to open/reset the menu
      if (['menu', 'catalog', 'shop', 'hi', 'hello'].includes(messageText)) {
        conversationStates.set(customerPhone, { step: 'WAITING_FOR_PRODUCT_SELECTION' });
        await sendProductListMenu(customerPhone);
        return;
      }

      // Check if user is replying with their Name & Address
      if (currentState && currentState.step === 'WAITING_FOR_ADDRESS') {
        const product = await Product.findOne({ _id: currentState.sku }).lean();
        
        if (!product || product.ProductQty <= 0) {
          await sendWhatsAppMessage(customerPhone, { type: 'text', text: { body: 'Sorry! Item is out of stock.' } });
          conversationStates.delete(customerPhone);
          return;
        }

        // 1. Decrement inventory
        await Product.findByIdAndUpdate(product._id, { $inc: { ProductQty: -1 } });

        // 2. Save order to database (Fixed: added deliveryDetails back)
        const newOrder = new Order({
          customerPhone,
          productSku: product._id,
          productName: product.productName,
          totalAmount: product.price,
          deliveryDetails: messageEntry.text.body, // Fixed
          status: 'Confirmed'
        });
        await newOrder.save();

        // 3. Confirm success
        await sendWhatsAppMessage(customerPhone, {
          type: 'text',
          text: { body: `✅ *Order Confirmed!*\nYour order for *${product.productName}* is placed successfully.` }
        });

        // Clear state
        conversationStates.delete(customerPhone);
        return;
      }
    }

    // ==========================================
    // 2. Handle Interactive Catalog / List Selection
    // ==========================================
    if (messageEntry.type === 'interactive') {
      const interactiveData = messageEntry.interactive;
      
      // Fixed: changed _id to id and added fallbacks for catalog items
      const selectedId = 
        interactiveData?.list_reply?._id || 
        interactiveData?.product_retailer_id || 
        interactiveData?.nfm_reply?.response_json?.product_retailer_id;

      console.log("Selected Product ID from catalog:", selectedId);

      if (!selectedId) {
        await sendWhatsAppMessage(customerPhone, { type: 'text', text: { body: "Could not find selected item. Please try again." } });
        return; // Fixed: uncommented return so it stops execution here
      }

      // Find product in database
      const query = { $or: [{ sku: selectedId }] };
      if (selectedId.match(/^[0-9a-fA-F]{24}$/)) {
        query.$or.push({ _id: selectedId });
      }
      
      const product = await Product.findOne(query).lean();

      if (!product || product.ProductQty <= 0) {
        await sendWhatsAppMessage(customerPhone, { type: 'text', text: { body: `Sorry, this item is out of stock.` } });
        return;
      }
     
      // Update state to next step: WAITING_FOR_ADDRESS, and store the chosen product SKU
      conversationStates.set(customerPhone, { step: 'WAITING_FOR_ADDRESS', sku: product._id });
    
      // Prompt user for delivery details
      await sendWhatsAppMessage(customerPhone, {
        type: 'text',
        text: { body: `You selected: *${product.productName}* (PKR ${product.price}).\n\nPlease reply with your:\n1. Full Name\n2. Complete Delivery Address` }
      });
      
      console.log("State updated to WAITING_FOR_ADDRESS:", conversationStates.get(customerPhone));
    }
  } catch (error) {
    console.log("Error occurred in webhook processing");
    console.error('Webhook error:', error);
  }
});
router.get('/webhook/whatsapp', (req, res) => {
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  mode = 'subscribe';
  token = process.env.VERIFY_TOKEN;
  challenge  ="123456"
  console.log('mode:', mode);
  console.log('token:', token);
  console.log('challenge:', challenge);

  // Replace 'YOUR_VERIFY_TOKEN' with whatever secret string you choose
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'my_secure_verify_token';
  console.log( "verify_token =",VERIFY_TOKEN);
  if (mode && token) {
    
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
      return res.status(200).send(challenge); // Echo back the challenge to Meta
    } else {
      return res.sendStatus(403); // Forbidden if tokens don't match
    }
  }
  return res.sendStatus(400);
});

module.exports = router;