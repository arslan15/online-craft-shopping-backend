const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  
  maintenanceMode: {
    type: Boolean,
    default: false,
  },
  userRegistration: {
    type: Boolean,
    default: true,
  },
  sessionTimeout: {
    type: Number,
    default: 60,
  },
   userLogin: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);