const express = require('express');
const router = express.Router();
const User = require('../model/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const SystemSettings = require('../model/systemSettings');
const { verifyToken, authorize } = require('../middleware/authMiddleware');
router.get('/', (req, res) => {
  res.send('User route working');
});
router.post('/login',async(req,res)=>{
try {
    const { email, password } = req.body;
    const settings = await SystemSettings.findOne();

    // 1. Validate inputs
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isBcryptHash = user.password.startsWith('$2a$') || user.password.startsWith('$2b$');
    let isPasswordValid = false;
    if(isBcryptHash){
      isPasswordValid = await bcrypt.compare(password, user.password);
    }
    else {
      // Legacy check: Compare plain-text directly
      isPasswordValid = user.password === password;
      // AUTO-MIGRATE: If plain-text password matched, convert it to bcrypt now!
      if (isPasswordValid) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        user.password = undefined;
        user.confirmPassword = undefined;
        await user.save(); 
      }
    }
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    if (settings && !settings.userLogin && user.role!="Admin") {
      return res.status(503).json({
        message: 'Application is currently under maintenance. Existing User Login are temporarily paused.',
      });
    }
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '1d' }
    );
  
  res.status(200).json({
      message: 'Login successful!',
      
      user: {
        token,
        id: user.id,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  }
  catch (error) {
    console.error('LOGIN ERROR:', error.message);
    res.status(500).json({ message: 'Server error during login.' });
  }
});
router.post('/register', async(req,res)=>{
  try {
    const settings = await SystemSettings.findOne();

  // 2. Reject registration if disabled
  if (settings && !settings.userRegistration) {
     
    return res.status(403).json({
      message: 'New user registration is currently disabled by the administrator.',
    });
  }
  // 3. Reject if maintenance mode is enabled and the user is NOT an Admin
    if (settings && settings.maintenanceMode === true && req.body.role !== 'Admin') {
      return res.status(503).json({
        message: 'Application is currently under maintenance. New user registrations are temporarily paused.',
      });
    }
    if (settings && settings.userLogin == false  && req.body.role !== 'Admin') {
      return res.status(503).json({
        message: 'Application is currently under maintenance. Existing User Login are temporarily paused.',
      });
    }

    console.log('1. Register endpoint hit with body:', req.body);
    let { name, email, password ,confirmPassword,role,isActive} = req.body;
    const saltRounds = 10;
    password = await bcrypt.hash(password, saltRounds);
    confirmPassword = await bcrypt.hash(confirmPassword, saltRounds);
   console.log('2. Querying MongoDB for email:', email);
    const existingUser = await User.findOne({ email });
console.log('3. Query completed. Result:', existingUser);
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const newUser = new User({name, email, password, confirmPassword, role: role, isActive: isActive });
    await newUser.save();

   res.status(201).json({ 
      message: 'Account created successfully!',
      user: {
        _id: newUser._id,
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        isActive: newUser.isActive
      }
    });
  } catch (error) {
    console.error('REGISTER CATCH ERROR:', error.message);
  
    res.status(500).json({ message: 'Server error during registration.' });

  }
})
router.get('/all', verifyToken,
  authorize(['Admin']), async (req, res) => {
  try {
    const users = await User.find({}, '-password'); // Exclude password field
    res.status(200).json(users);
  } catch (error) {
    console.error('GET USERS ERROR:', error.message);
    res.status(500).json({ message: 'Server error fetching users.' });
  }
});
router.patch('/:id/toggle-active', verifyToken,
  authorize(['Admin']), async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.isActive = !user.isActive;
    await user.save();
    res.status(200).json({ message: 'User status updated', isActive: user.isActive });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user status' });
  }
});
router.put('/settings', verifyToken,
  authorize(['Admin']), async (req, res) => {
  try {

    const { siteName, maintenanceMode, userRegistration ,userLogin} = req.body;
console.log('--- 1. SETTINGS ENDPOINT HIT ---');
  console.log('Incoming Payload:', req.body);
    const updatedSettings = await SystemSettings.findOneAndUpdate(
      {},
      {
        $set: {
          siteName,
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

    res.status(200).json({
      message: 'Settings saved successfully!',
      settings: updatedSettings,
    });
  } catch (error) {
    console.error('UPDATE SETTINGS ERROR:', error);
    res.status(500).json({ message: 'Failed to save settings.', error: error.message });
  }
});
router.get('/settings', verifyToken,
  authorize(['Admin']),async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      // Create defaults in DB if no record exists yet
      settings = await SystemSettings.create({
        siteName: 'Arslan Company',
        maintenanceMode: false,
        userRegistration: true,
        sessionTimeout: 60,
        userLogin:true
      });
    }
    console.log(settings);
    res.status(200).json(settings);
  } catch (error) {
    console.error('GET SETTINGS ERROR:', error.message);
    res.status(500).json({ message: 'Failed to fetch settings.' });
  }
});
// Express route example: PUT /api/users/change-password
router.put('/users/change-password', verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id; // Extracted from token middleware

  const user = await User.findById(userId);
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  
  if (!isMatch) {
    return res.status(400).json({ message: 'Incorrect current password.' });
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.json({ message: 'Password updated successfully!' });
});
router.put('/users/:id', verifyToken, async (req, res) => {
  try {
    const { name, email, role } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { name, email, role } },
      { new: true, runValidators: true } // Return the updated document & run schema checks
    ).select('-password'); // Exclude password from the response

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ 
      message: 'User updated successfully', 
      user: updatedUser 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
module.exports = router;