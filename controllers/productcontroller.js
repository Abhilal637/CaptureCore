exports.editProduct = async (req, res) => {
    try {
        const prod = await product.findById(req.params.id);
        if (!prod) return res.status(404).send("Product not found");
        res.render('admin/editproduct', { product: prod });
    } catch (err) {
        console.error(err);
        res.status(500).send("error loading product");
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const updateData = {
            name: req.body.name,
            description: req.body.description,
            price: req.body.price
        };
        if (req.files && req.files.length >= 3) {
            const imagePaths = [];
            for (let i = 0; i < req.files.length; i++) {
                const filename = `product=${Date.now()}-edit-${i}.jpeg`;
                const filepath = path.join(__dirname, '../public/uploads', filename);
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
const product = require('../models/product');
const sharp = require('sharp');
const fs= require('fs')
const path = require('path');

exports.listProducts = async (req, res) => {
    try {
        const products = await product.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 });
        res.render('admin/products', { products });
    } catch (err) {
        console.error(err);
        res.status(500).send("error loading products");
    }
}

exports.addproduct = async(req,res)=>{
    try{
        if(!req.files || req.files.length <3){
            return res.status(400).status(400).send('upload at least 3 images')
        }
        const imagePaths=[]

        for(let i=0;i<req.files.length;i++){
            const filename = `product=${Date.now()}-${i}.jpeg`;
            const filepath =path.join(__dirname,'../public/uploads',filename)

        await sharp(req.files[i].buffer)
        .resize(800, 800)
         .jpeg({quality:90})
        .toFile(filepath)

                imagePaths.push(`/uploads/products/${filename}`);
        }
        const newProduct = new product({
            name:req.body.name,
            description:req.body.description,
            price:req.body.price,
            images:imagePaths
        });

        await newProduct.save();
        res.redirect('/admin/products');

    }
    catch(err){
        console.error(err);
        res.status(500).send("error adding product")
    }
}


exports.deleteProduct = async (req, res) => {
    try {
        await product.findByIdAndUpdate(req.params.id, { isDeleted: true });    
        res.redirect('/admin/products');
    } catch (err) {
        console.error(err);
        res.status(500).send("error deleting product");
    }
}
