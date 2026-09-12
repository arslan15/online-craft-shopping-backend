const express = require('express');
const Product = require('../model/Product');
const router = express.Router();
const multer = require('multer');
const { verifyToken, authorize } = require('../middleware/authMiddleware');
const cloudinary = require('./utils/cloudinary'); // Adjust path as needed
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
    const newProduct = new Product({
      productName, 
      ProductDescription, 
      productCategoryType, 
      ProductQty,
      ImageUrl: cloudinaryResult.secure_url,
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
    
    // Transform each product to include the Base64 image URL string
    const formattedProducts = Products.map(product => {
      let base64Image = '';
      if (product.image && product.image.data) {
        let rawData = product.image.data;

        // Safely unwrap Mongoose .lean() binary formats
        if (rawData.buffer) {
          rawData = rawData.buffer; 
        } else if (rawData.data && Array.isArray(rawData.data)) {
          rawData = rawData.data; 
        }

        const buffer = Buffer.from(rawData);

        if (buffer.length > 0) {
          const contentType = product.image.contentType || 'image/jpeg';
          base64Image = `data:${contentType};base64,${buffer.toString('base64')}`;
        }
      }

      return {
        ...product,
        imageUrl: base64Image, // Usable Base64 string for frontend <img src="..." />
        image: undefined       // Strip out raw buffer to keep response payload lean
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