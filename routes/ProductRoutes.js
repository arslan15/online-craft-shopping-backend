const express = require('express');
const Product = require('../model/Product');
const router = express.Router();
const multer = require('multer');
const { verifyToken, authorize } = require('../middleware/authMiddleware');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get('/', (req, res) => {
  res.send('Product route working');
});
router.post('/addProduct',upload.single('ImageUrl'), verifyToken,
  authorize(['Admin']), async(req,res)=>{
  try {
    console.log(verifyToken);
    const {productName, ProductDescription, productCategoryType,ProductQty,price} = req.body;
    console.log("req.body:", req.body);
    if (!req.file) {
            return res.status(400).json({ message: 'Product image is required.' });
        }
    const newProduct = new Product({productName, ProductDescription, productCategoryType,ProductQty,image: {
                data: req.file.buffer,
                contentType: req.file.mimetype
            },price });
    await newProduct.save();

    res.status(201).json({ message: 'Product added successfully!'
      ,product: newProduct });
  } catch (error) {
    console.error('ADD PRODUCT CATCH ERROR:', error.message);
  
    res.status(500).json({ message: 'Server error during adding product.' });

  }
})
router.get('/Products', verifyToken, authorize(['User','Admin']), async (req, res) => {
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

    // Use .lean() to get plain JS objects instead of heavy Mongoose documents
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
          rawData = rawData.buffer; // BSON Binary format
        } else if (rawData.data && Array.isArray(rawData.data)) {
          rawData = rawData.data; // { type: 'Buffer', data: [...] } format
        }

        const buffer = Buffer.from(rawData);

        if (buffer.length > 0) {
          const contentType = product.image.contentType || 'image/jpeg';
          base64Image = `data:${contentType};base64,${buffer.toString('base64')}`;
        }
      }

      return {
        ...product,
        imageUrl: base64Image, // Attach usable Base64 string
        image: undefined       // Strip out raw buffer to keep payload small
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