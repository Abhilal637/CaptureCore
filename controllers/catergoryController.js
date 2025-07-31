const category= require('../models/category');


exports.listCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : '';

    let query = { isDeleted: false }; //shows both activve and non active  catregories
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await category.countDocuments(query);
    const categories = await category
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.render('admin/category', {
      categories,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      limit,
      search
    });
  } catch (err) {
    res.status(500).send("Server error");
  }
};

exports.addCategory = async (req, res) => {
    try {
        const name = req.body.name && req.body.name.trim();
        const description = req.body.description && req.body.description.trim();
        
        if (!name || !description) {
            return res.status(400).send("Category name and description are required");
        }

        // Check for existing category (case-insensitive)
        const existingCategory = await category.findOne({ 
            name: { $regex: new RegExp(`^${name}$`, 'i') },
            isDeleted: false 
        });
        
        if (existingCategory) {
            return res.status(400).send('Category already exists.');
        }

        await category.create({ 
            name: name, 
            description: description, 
            active: true,
            isDeleted: false
        });
        
        res.redirect('/admin/category');
    } catch (err) {
        console.error('Error adding category:', err);
        res.status(500).send("Error adding category: " + err.message);
    }
}


exports.deleteCategory = async (req, res) => {
    try{
        await category.findByIdAndUpdate(req.params.id, { active: false, isDeleted: true });
        if (req.xhr) {
            return res.status(200).json({ success: true });
        }
        res.redirect("/admin/category")
    }catch(err){
        res.status(500).send("error deleting category")
    }
}

exports.editcategory= async(req,res)=>{
  try{
    const cat=await category.findById(req.params.id);
    if(!cat)return res.status(404).send("category not found")
      res.render('admin/editcategory', { category: cat });
  }catch(err){
    res.status(500).send("error loading category");
  }
}

exports.updateCategory = async(req,res)=>{
  try{
    const { name, description, active } = req.body;
    const categoryId = req.params.id;
    
    if (!name || !description) {
        return res.status(400).send("Category name and description are required");
    }

    const existingCategory = await category.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: categoryId },
        isDeleted: false 
    });
    
    if (existingCategory) {
        return res.status(400).send('Category name already exists.');
    }

    await category.findByIdAndUpdate(categoryId, {
        name: name.trim(),
        description: description.trim(),
        active: active === "true"
    });
    
    res.redirect('/admin/category');
  }catch(err){
    console.error('Error updating category:', err);
    res.status(500).send("Error updating category: " + err.message);
  }
}
exports.toggleCategoryStatus = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { active } = req.body;

    const cat = await category.findById(categoryId);
    if (!cat) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    cat.active = active;
    await cat.save();
    console.log("Received toggle request:", req.params.id, req.body.active);


    res.status(200).json({ success: true, message: 'Category status updated successfully.' });
  } catch (err) {
    console.error('Error updating category status:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
