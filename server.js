require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const flash = require('connect-flash');
const session = require("express-session");
const passport = require('./config/passport');
const connectDB = require('./mongoDb/connection');

// Routes
const userRoute = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoute');

// Middleware
const sessionConfig = require('./middleware/sessionConfig');
const setUserLocals = require('./middleware/setUserLocals');
const adminSessionHandler = require('./middleware/adminSessionHandler');
const errorHandler = require('./middleware/errorHandler');

// Socket
const setupSocket = require('./socket/socket');

const app = express();
const server = http.createServer(app);

// Database
connectDB();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sessions
app.use(session(sessionConfig));
app.use(adminSessionHandler);

// Flash & Passport
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// Set user locals
app.use(setUserLocals);

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Routes
app.use('/', userRoute);
app.use('/admin', adminRoutes);

// Socket.IO setup
setupSocket(server);

// Error handling
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
