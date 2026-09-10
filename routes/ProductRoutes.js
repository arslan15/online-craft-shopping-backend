const express = require('express');
const Product = require('../model/Product');
const router = express.Router();
const { verifyToken, authorize } = require('../middleware/authMiddleware');
router.get('/', (req, res) => {
  res.send('Product route working');
});
router.post('/addProduct', verifyToken,
  authorize(['Admin']), async(req,res)=>{
  try {
    console.log(verifyToken);
    const {productName, ProductDescription, productCategoryType,ProductQty,ImageUrl,price} = req.body;
    const newProduct = new Product({productName, ProductDescription, productCategoryType,ProductQty,ImageUrl,price });
    await newProduct.save();

    res.status(201).json({ message: 'Product added successfully!'
      ,product: newProduct });
  } catch (error) {
    console.error('ADD PRODUCT CATCH ERROR:', error.message);
  
    res.status(500).json({ message: 'Server error during adding product.' });

  }
})
router.get('/Products', verifyToken,
  authorize(['User','Admin']),async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    // Read limit from query parameters (defaults to 10)
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
    const [Products, totalProducts] = await Promise.all([
      Product.find(filter).skip(skip).limit(limit),
      Product.countDocuments(filter)
    ]);
    
    const totalPages = Math.ceil(totalProducts / limit) || 1;
    res.status(200).json({
    success: true,
    data: Products,
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