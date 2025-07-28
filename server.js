const express = require('express');
const path = require('path');
const app = express();
const connectDB = require('./mongoDb/connection');
const dotenv = require('dotenv');
const userRoute = require('./routes/userRoutes');
const session = require("express-session")
const adminRoutes = require('./routes/adminRoute');
const User = require('./models/user'); // Make sure this line is at the top

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

connectDB();
// Move body parser middleware above routes
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,          
    secure: false,           
    maxAge: 1000 * 60 * 60   
  }
}));
app.use(async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId);
      res.locals.user = user;
    } catch (err) {
      res.locals.user = null;
    }
  } else {
    res.locals.user = null;
  }
  next();
});
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/', userRoute); 
app.use('/admin', adminRoutes);



app.get('/account/profile', (req, res) => {
  res.render('user/profile', { currentPage: 'profile' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
