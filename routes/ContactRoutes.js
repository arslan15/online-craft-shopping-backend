const express = require('express');
const router = express.Router();
const Contact = require('../model/Contact');
const sendContactEmail = require('../utils/sendContactEmail');

router.get('/',(req, res) => {
  res.send('Contact route working');
});
// GET: Fetch all contact messages for the admin dashboard
router.get('/admin/messages', async (req, res) => {
  try {
    // Extract page and limit from query parameters, with safe defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch messages with pagination and sorting (newest first)
    const messages = await Contact.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get the total count for proper pagination handling on the frontend
    const totalCount = await Contact.countDocuments();

    return res.status(200).json({ 
      success: true, 
      count: totalCount, 
      data: messages 
    });
  } catch (error) {
    console.error('Failed to fetch admin messages:', error);
    return res.status(500).json({ error: 'Failed to retrieve messages.' });
  }
});
router.post('/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;
  try {
    // Basic validation
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Please fill in all required fields.' });
    }
    
    await Contact.create({ name, email, subject, message });
    await sendContactEmail({ name, email, subject, message,emailTo:"asarslansaeed1678@gmail.com" });
    
    return res.status(200).json({ 
      success: true, 
      message: 'Contact form submitted successfully!' 
    });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Server error, please try again later.' });
  }
});
// PATCH: Mark a specific message as read (Optional helper)
router.patch('/admin/messages/:id/read', async (req, res) => {
  try {
    const updatedMessage = await Contact.findByIdAndUpdate(
      req.params.id, 
      { isRead: true }, 
      { new: true } // Ensures the updated document is returned
    );

    if (!updatedMessage) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }
    
    // Recalculate unread count and broadcast via socket
    const unreadCount = await Contact.countDocuments({ isRead: false });
    const io = req.app.get('io');
    if (io) {
      io.emit('updateNotificationCount', { unreadCount });
    }

    return res.status(200).json({ success: true, message: 'Marked as read', data: updatedMessage });
  } catch (error) {
    console.error('Failed to update message status:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});
// GET: Fetch unread count for the admin notification badge
router.get('/admin/notifications/unread-count', async (req, res) => {
  try {
    const unreadCount = await Contact.countDocuments({ isRead: false });
    return res.status(200).json({ success: true, unreadCount });
  } catch (error) {
    console.error('Failed to fetch unread count:', error);
    return res.status(500).json({ error: 'Failed to retrieve notification count.' });
  }
});

module.exports = router;