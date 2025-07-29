const User = require("../models/user");
const bcrypt = require('bcrypt');

function setNoCache(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

exports.getLogin = (req, res) => {
  setNoCache(res);
  res.render('admin/login', { error: null });
};
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user || !user.isAdmin) {
      return res.render('admin/login', { error: 'Access denied: Not an admin' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('admin/login', { error: 'Invalid email or password' });
    }

    req.session.isAdmin = true;
    req.session.admin = {
      name: user.name,
      email: user.email,
      role: 'admin'
    };

    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('Login error:', err); 
    res.render('admin/login', { error: 'Server error. please try again' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;

    const query = {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } }
      ]
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);
    setNoCache(res);
    res.render('admin/userslist', {
      users,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      search
    });
  } catch (err) {
    res.status(500).send("Server Error");
  }
};
exports.dashboard = (req, res) => {
  const admin = req.session.admin || { name: 'Admin',role: 'Admin' };
  const  stats={
    totalUsers :75000,
    totalOrders:7500,
    totalSales:7500,
  }
  res.render('admin/dashboard',{admin,stats});
}
exports.blockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { blocked: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { blocked: false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};



exports.postAddProduct= async(req,res)=>{
  try{
    const {name,descrption,price,cateogry}=req.body
    const uploadImages=[]

    for(const file of req.files){
      const uploadPromise= new Promise ((resolve, reject)=>{
        const stream = cloudinary.uploader.upload_stream({
          folder:"products",
          resource_type:'image'
        },
        (error,result)=>{
          if(eroor)return reject(error);
          uploadImages.push(result.secure_url)
          resolve()
        }
      )
      streamifier.createReadStream(file.buffer).pipe(stream)
      })
      await uploadPromise
    }

    const newProduct = new product({
      name,
       description,
      price,
      category,
      images: uploadedImages,
      isBlocked: false,
      isListed: true,
      isDeleted: false
    })
    await newProduct.save();
    res.redirect('/admin/product')

  }catch(err){
    console.log('upload error',err);
    res.status(500).send('upload failed')
  }
}

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid', { path: '/' });
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.redirect('/admin/login');
  });
};
