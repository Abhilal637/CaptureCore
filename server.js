const express = require('express');
const path = require('path');
const app = express();
const connectDB = require('./mongoDb/connection');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const userRoute = require('./routes/userRoutes');
const session = require("express-session");
const adminRoutes = require('./routes/adminRoute');
const User = require('./models/user');
const passport = require('./config/passport');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

connectDB();

// Body parser middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // set `true` only if using HTTPS
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Middleware to set res.locals.user for all views
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

// Static files
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
