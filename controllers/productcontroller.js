const product = require('../models/product');
const Category = require('../models/category');
const sharp = require('sharp');
const fs= require('fs')
const path = require('path');
const { v4: uuidv4 } = require('uuid');

exports.listProducts = async (req, res) => {
  try {
    const perPage = 10; // items per page
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const categoryFilter = req.query.category || '';
    const brandFilter = req.query.brand || '';

    // Build search filter
    const filter = {
      isDeleted: { $ne: true },
    };

    if (search.trim() !== '') {
      filter.name = { $regex: search.trim(), $options: 'i' };
    }

    // Filter by category
    if (categoryFilter) {
      filter.category = categoryFilter;
    }

    // Filter by brand
    if (brandFilter) {
      filter.brand = { $regex: brandFilter, $options: 'i' };
    }

    // Count total matching documents
    const totalCount = await product.countDocuments(filter);

    // Fetch paginated results
    const products = await product
      .find(filter)
      .populate('category')
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage);

    const totalPages = Math.ceil(totalCount / perPage);

    // Get all categories for filter dropdown
    const categories = await Category.find({
      isDeleted: false,
      active: true
    }).populate('parentCategory', 'name').sort({ name: 1 });

    res.render('admin/products', {
      products,
      categories,
      search,
      categoryFilter,
      brandFilter,
      currentPage: page,
      totalPages,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading products');
  }
};


exports.addproduct = async(req,res)=>{
    try{
        if(!req.files || req.files.length <3){
            return res.status(400).send('upload at least 3 images')
        }
        
        const { name, description, price, brand, megapixelBucket, batteryType, cameraType, lensMount, focalLength, fAperture, lensType, availability, category: categoryId, stock } = req.body;
        
        // Find category by ID instead of name
        let category = await Category.findById(categoryId);
        if (!category) {
            return res.status(400).send('Invalid category selected');
        }
        
        const imagePaths = []
        for(let i=0;i<req.files.length;i++){
            const filename = `product=${Date.now()}-${i}.jpeg`;
            const filepath = path.join(__dirname,'../public/uploads/products',filename)
            await sharp(req.files[i].buffer)
                .resize(800, 800, { fit: 'cover' })
                .jpeg({quality:90})
                .toFile(filepath)

            imagePaths.push(`/uploads/products/${filename}`);
        }
        
        const newProduct = new product({
            name: name,
            description: description,
            price: price,
            brand: brand,
            megapixelBucket: megapixelBucket || undefined,
            batteryType: batteryType || undefined,
            cameraType: cameraType || undefined,
            lensMount: lensMount || undefined,
            focalLength: focalLength || undefined,
            fAperture: fAperture || undefined,
            lensType: lensType || undefined,
            availability: availability || (Number(stock) > 0 ? 'in-stock' : 'backorder'),
            category: category._id,
            images: imagePaths,
            isBlocked: false,
            isListed: true,
            isDeleted: false,
            stock: stock || 0, 
        });

        await newProduct.save();
        res.redirect('/admin/products');

    }
    catch(err){
        console.error('Error adding product:', err);
        res.status(500).send("error adding product: " + err.message);
    }
}

exports.editProduct = async (req, res) => {
    try {
        const prod = await product.findById(req.params.id).populate('category');
        if (!prod) return res.status(404).send("Product not found");
        
        // Get all categories for selection
        const categories = await Category.find({
            isDeleted: false,
            active: true
        }).populate('parentCategory', 'name').sort({ name: 1 });
        
        res.render('admin/editprodcutpage', { 
            product: prod,
            categories 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("error loading product");
    }
};


exports.updateProduct = async (req, res) => {
  try {
    const { name, description, stock, brand, megapixelBucket, batteryType, cameraType, lensMount, focalLength, fAperture, lensType, availability, category, croppedImages = [], existingImages = [] } = req.body;
    const productId = req.params.id;

    const currentProduct = await product.findById(productId);

    // Validate category if provided
    if (category) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(400).send('Invalid category selected');
      }
    }

    const updatedFields = {
      ...(name && { name }),
      ...(description && { description }),
      ...(brand && { brand }),
      ...(megapixelBucket && { megapixelBucket }),
      ...(batteryType && { batteryType }),
      ...(cameraType && { cameraType }),
      ...(lensMount && { lensMount }),
      ...(focalLength && { focalLength }),
      ...(fAperture && { fAperture }),
      ...(lensType && { lensType }),
      ...(availability && { availability }),
      ...(stock && { stock: parseInt(stock) }),
      ...(category && { category }),
      isListed: currentProduct.isListed,
      isActive: currentProduct.isActive,
      isBlocked: currentProduct.isBlocked,
      isDeleted: currentProduct.isDeleted,
      images: currentProduct.images 
    };

    let finalImagePaths = [];


    if (croppedImages && croppedImages.length >= 3) {
      for (let i = 0; i < croppedImages.length; i++) {
        const base64Data = croppedImages[i];
        if (base64Data && base64Data.startsWith('data:image')) {
          const matches = base64Data.match(/^data:image\/(jpeg|png);base64,(.+)$/);
          if (!matches) continue;

          const ext = matches[1] === 'png' ? 'png' : 'jpg';
          const buffer = Buffer.from(matches[2], 'base64');

          const filename = `${uuidv4()}.${ext}`;
          const filePath = path.join(__dirname, '../public/uploads/products', filename);

          
          fs.writeFileSync(filePath, buffer);
          finalImagePaths.push(`/uploads/products/${filename}`);
        } else {
         
          if (existingImages[i]) {
            finalImagePaths.push(existingImages[i]);
          }
        }
      }

      updatedFields.images = finalImagePaths;
    }

    await product.findByIdAndUpdate(productId, updatedFields, { new: true });

    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).send('Server Error');
  }
};

exports.toggleProductStatus = async (req, res) => {
  try {
    const productId = req.params.id;
    const currentProduct = await product.findById(productId);

    if (!currentProduct) return res.status(404).send("Product not found");

    const updatedProduct = await product.findByIdAndUpdate(
      productId,
      { isActive: !currentProduct.isActive },
      { new: true }
    );

    res.redirect('/admin/products');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error toggling product status");
  }
};


