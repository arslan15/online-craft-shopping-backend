const express = require('express');
const router = express.Router();
const axios = require('axios');
const Product = require('../model/Product'); // Adjust path based on your folder structure
const Order = require('../model/Order');     // Adjust path based on your folder structure

const conversationStates = new Map();
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Helper function to send messages via Meta Cloud API
async function sendWhatsAppMessage(recipientPhone, payload) {
  try {
    await axios({
      url: `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
      method: 'post',
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: { messaging_product: 'whatsapp', to: recipientPhone, ...payload },
    });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.response?.data || error.message);
  }
}

// 1. Webhook Verification (Meta setup)
router.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  console.log("called");

  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// 2. Webhook Event Receiver
router.post('/webhook/whatsapp', async (req, res) => {
  res.status(200).send('Event Received');

  try {
    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    const messageEntry = value?.messages?.[0];
    if (!messageEntry) return;

    const customerPhone = messageEntry.from;

    // Handle Text Input (Delivery Address step)
    if (messageEntry.type === 'text') {
      const currentState = conversationStates.get(customerPhone);

      if (currentState && currentState.step === 'WAITING_FOR_ADDRESS') {
        const product = await Product.findOne({ sku: currentState.sku });
        if (!product || product.stock <= 0) {
          await sendWhatsAppMessage(customerPhone, { type: 'text', text: { body: 'Sorry! Item is out of stock.' } });
          conversationStates.delete(customerPhone);
          return;
        }

        product.stock -= 1;
        await product.save();

        const newOrder = new Order({
          customerPhone,
          productSku: product.sku,
          productName: product.name,
          price: product.price,
          deliveryDetails: messageEntry.text.body,
          status: 'Confirmed'
        });
        await newOrder.save();

        await sendWhatsAppMessage(customerPhone, {
          type: 'text',
          text: { body: `✅ *Order Confirmed!*\nYour order for *${product.name}* is placed successfully.` }
        });

        conversationStates.delete(customerPhone);
        return;
      }

      // Default greeting: Send list menu
      await sendProductListMenu(customerPhone);
    }

    // Handle List Selection
    if (messageEntry.type === 'interactive') {
      const selectedSku = messageEntry.interactive.list_reply.id;
      const product = await Product.findOne({ sku: selectedSku });

      if (!product || product.stock <= 0) {
        await sendWhatsAppMessage(customerPhone, { type: 'text', text: { body: `Sorry, item is out of stock.` } });
        return;
      }

      conversationStates.set(customerPhone, { step: 'WAITING_FOR_ADDRESS', sku: selectedSku });

      await sendWhatsAppMessage(customerPhone, {
        type: 'text',
        text: { body: `You selected: *${product.name}* (PKR ${product.price}).\n\nPlease reply with your:\n1. Full Name\n2. Complete Delivery Address` }
      });
    }
  } catch (error) {
    console.error('Webhook error:', error);
  }
});

async function sendProductListMenu(recipientPhone) {
  await sendWhatsAppMessage(recipientPhone, {
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: 'Catalog Menu' },
      body: { text: 'Please select an item below to place your order:' },
      footer: { text: 'Automated Store' },
      action: {
        button: 'View Products',
        sections: [
          {
            title: 'Handmade Items',
            rows: [
              { id: 'item_001', title: 'Mini Clay Pot', description: 'Hand-painted miniature clay pot (PKR 1,500)' },
              { id: 'item_002', title: 'Sunset Canvas', description: 'Acrylic canvas painting (PKR 3,000)' }
            ]
          }
        ]
      }
    }
  });
}

module.exports = router;