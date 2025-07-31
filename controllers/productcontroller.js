const product = require('../models/product');
const Category = require('../models/category');
const sharp = require('sharp');
const fs= require('fs')
const path = require('path');

exports.listProducts = async (req, res) => {
    try {
        const products = await product.find({ isDeleted: { $ne: true } }).populate('category').sort({ createdAt: -1 });
        res.render('admin/products', { products });
    } catch (err) {
        console.error(err);
        res.status(500).send("error loading products");
    }
}

exports.addproduct = async(req,res)=>{
    try{
        if(!req.files || req.files.length <3){
            return res.status(400).send('upload at least 3 images')
        }
        
        const { name, description, price, category: categoryName,stock } = req.body;
        
        
        let category = await Category.findOne({ name: categoryName, isDeleted: false });
        if (!category) {
           // herer we are creating a new category 
            category = new Category({
                name: categoryName,
                description: categoryName,
                active: true,
                isDeleted: false
                
            });
            await category.save();
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
            category: category._id,
            images: imagePaths,
            isBlocked: false,
            isListed: true,
            isDeleted: false,
            stock: stock || 0, //making stock  0 to defailt
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
        res.render('admin/editprodcutpage', { product: prod });
    } catch (err) {
        console.error(err);
        res.status(500).send("error loading product");
    }
};
exports.updateProduct = async (req, res) => {
  try {
    const { name, description, stock } = req.body;
    const productId = req.params.id;

    const updatedFields = {
      name,
      description,
      stock: parseInt(stock),
    };

  
    if (req.file) {
      updatedFields.image = req.file.filename;
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


