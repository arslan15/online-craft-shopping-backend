const express = require('express');
const Product = require('../model/Product');
const router = express.Router();
const multer = require('multer');
const { verifyToken, authorize } = require('../middleware/authMiddleware');
const cloudinary = require('../utils/cloudinary'); // Adjust path as needed
const streamifier = require('streamifier');

// Configure multer to use memory storage (Safe for Vercel serverless)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 4 * 1024 * 1024 } // 4MB limit to stay safely under Vercel's limits
});

// Test route
router.get('/', (req, res) => {
  res.status(200).json({ message: 'Product route working' });
});

// Add Product Route
router.post('/addProduct', upload.single('ImageUrl'), verifyToken, authorize(['Admin']), async (req, res) => {
  try {
    const { productName, ProductDescription, productCategoryType, ProductQty, price } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Product image is required.' });
    }

    // Function to handle stream upload to Cloudinary from memory buffer
    const uploadFromBuffer = (req) => {
      return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
          { folder: 'ecommerce-products' },
          (error, result) => {
            if (result) {
              resolve(result);
            } else {
              reject(error);
            }
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };
    // Wait for Cloudinary upload to finish
    const cloudinaryResult = await uploadFromBuffer(req);
    console.log('Cloudinary upload result:', cloudinaryResult);
    const newProduct = new Product({
      productName, 
      ProductDescription, 
      productCategoryType, 
      ProductQty,
      image: cloudinaryResult.secure_url,
      price 
    });

    await newProduct.save();

    res.status(201).json({ 
      message: 'Product added successfully!', 
      product: newProduct 
    });

  } catch (error) {
    console.error('ADD PRODUCT CATCH ERROR:', error.message);
    res.status(500).json({ message: 'Server error during adding product.' });
  }
});

// Get Products Route (with Pagination, Search, and Base64 Image Formatting)
router.get('/Products', verifyToken, authorize(['User', 'Admin']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    const search = req.query.search ? req.query.search.trim() : '';
    
    // Safety cap: max 100 items per request
    if (limit > 100) limit = 100;
    const skip = (page - 1) * limit;

    // Build the query filter
    let filter = {};
    if (search) {
      filter = {
        $or: [
          { productName: { $regex: search, $options: 'i' } },
          { productCategoryType: { $regex: search, $options: 'i' } },
          { ProductDescription: { $regex: search, $options: 'i' } },
        ],
      };
    }

    // Use .lean() for high performance on serverless
    const [Products, totalProducts] = await Promise.all([
      Product.find(filter).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter)
    ]);
    
    // Backward-compatible image resolver
    const formattedProducts = Products.map(product => {
      let resolvedImageUrl = '';

      if (typeof product.image === 'string') {
        // 1. New Cloudinary URL format
        resolvedImageUrl = product.image;
      } else if (product.image && product.image.data) {
        // 2. Old binary buffer format
        let rawData = product.image.data;

        if (rawData.buffer) {
          rawData = rawData.buffer; 
        } else if (rawData.data && Array.isArray(rawData.data)) {
          rawData = rawData.data; 
        }

        const buffer = Buffer.from(rawData);

        if (buffer.length > 0) {
          const contentType = product.image.contentType || 'image/jpeg';
          resolvedImageUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
        }
      }

      return {
        ...product,
        imageUrl: resolvedImageUrl,
        ImageUrl: resolvedImageUrl
      };
    });

    const totalPages = Math.ceil(totalProducts / limit) || 1;

    res.status(200).json({
      success: true,
      data: formattedProducts,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalProducts,
        limit
      }
    });

  } catch (error) {
    console.error('GET Product ERROR:', error.message);
    res.status(500).json({ message: 'Server error fetching Products.' });
  }
});
module.exports = router;