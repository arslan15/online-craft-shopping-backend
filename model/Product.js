const mongoose = require('mongoose');
const productSchema = new mongoose.Schema({
  id: {
      type: Number,
    },
    productName: {
      type: String,
      required: true,
    },
    ProductDescription: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
      productCategoryType: {
      type: String,
      required: true,
      lowercase: true,
    },
      ProductQty: {
      type: Number,
      required: true
      
    },
    image: {
        
        type: String
    },
      price: {
      type: Number,
      required: true
      
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('product', productSchema);