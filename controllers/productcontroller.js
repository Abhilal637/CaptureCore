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
        
        // Find or create category
        let category = await Category.findOne({ name: categoryName, isDeleted: false });
        if (!category) {
            // Create new category if it doesn't exist
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

            // Process the cropped image (already cropped from frontend)
            await sharp(req.files[i].buffer)
                .resize(800, 800, { fit: 'cover' }) // Ensure consistent size
                .jpeg({quality:90})
                .toFile(filepath)

            imagePaths.push(`/uploads/products/${filename}`);
        }
        
        const newProduct = new product({
            name: name,
            description: description,
            price: price,
            category: category._id, // Use the ObjectId reference
            images: imagePaths,
            isBlocked: false,
            isListed: true,
            isDeleted: false,
            stock: stock || 0, // Use provided stock or default to 0
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
        res.render('admin/editproduct', { product: prod });
    } catch (err) {
        console.error(err);
        res.status(500).send("error loading product");
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { name, description, price, category: categoryName } = req.body;
        
        // Find or create category
        let category = await Category.findOne({ name: categoryName, isDeleted: false });
        if (!category) {
            category = new Category({
                name: categoryName,
                description: categoryName,
                active: true,
                isDeleted: false
            });
            await category.save();
        }
        
        const updateData = {
            name: name,
            description: description,
            price: price,
            category: category._id
        };
        
        if (req.files && req.files.length >= 3) {
            const imagePaths = [];
            for (let i = 0; i < req.files.length; i++) {
                const filename = `product=${Date.now()}-edit-${i}.jpeg`;
                const filepath = path.join(__dirname, '../public/uploads/products', filename);
                await sharp(req.files[i].buffer)
                    .resize(800, 800)
                    .jpeg({ quality: 90 })
                    .toFile(filepath);
                imagePaths.push(`/uploads/products/${filename}`);
            }
            updateData.images = imagePaths;
        }
        await product.findByIdAndUpdate(req.params.id, updateData);
        res.redirect('/admin/products');
    } catch (err) {
        console.error(err);
        res.status(500).send("error updating product");
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        await product.findByIdAndUpdate(req.params.id, { isDeleted: true });    
        res.redirect('/admin/products');
    } catch (err) {
        console.error(err);
        res.status(500).send("error deleting product");
    }
}
