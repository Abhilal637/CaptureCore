const express = require('express');
const path = require('path');
const app = express();
const connectDB = require('./mongoDb/connection');
const dotenv = require('dotenv');
const flash = require('connect-flash');
const http = require('http');
const socketIo = require('socket.io');

const userRoute = require('./routes/userRoutes');
const session = require("express-session");
const adminRoutes = require('./routes/adminRoute');
const User = require('./models/user');
const passport = require('./config/passport');
const validate = require('./middleware/validate');

dotenv.config();


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


connectDB();


app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 }
}));

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

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


const server = http.createServer(app);
const io = socketIo(server);

app.get('/orders', (req, res) => {
  res.render('user/order');
});


global.userSockets = new Map();
global.io = io;

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);


  socket.on('registerUser', (userId) => {
    if (userId) {
      global.userSockets.set(userId.toString(), socket.id);
      console.log(`User ${userId} registered with socket ${socket.id}`);
    }
  });


  socket.on('user_logout', (userId) => {
    global.userSockets.delete(userId.toString());
    console.log(`User ${userId} logged out manually`);
  });

 
  socket.on('disconnect', () => {
    for (const [userId, socketId] of global.userSockets.entries()) {
      if (socketId === socket.id) {
        global.userSockets.delete(userId);
        console.log(`User ${userId} disconnected`);
        break;
      }
    }
  });
});


app.set('io', io);
app.set('userSockets', global.userSockets);


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
