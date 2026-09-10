const express = require('express');
const router = express.Router();
const Contact = require('../model/Contact');
const { verifyToken, authorize } = require('../middleware/authMiddleware');

router.get('/',(req, res) => {
  res.send('Contact route working');
});
router.post('/contact',verifyToken,authorize(['Admin','User']),async (req,res)=>{
    const { name, email, subject, message } = req.body;
try {
    // Basic validation
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Please fill in all required fields.' });
    }
    await Contact.create({ name, email, subject, message });
    return res.status(200).json({ 
      success: true, 
      message: 'Contact form submitted successfully!' 
    });
} catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Server error, please try again later.' });
  }
})

module.exports = router;