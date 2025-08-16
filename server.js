require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const flash = require('connect-flash');
const session = require("express-session");
const passport = require('./config/passport');
const connectDB = require('./mongodb/connection');


const userRoute = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoute');

const sessionConfig = require('./middleware/sessionConfig');
const setUserLocals = require('./middleware/setUserLocals');
const adminSessionHandler = require('./middleware/adminSessionHandler');
const errorHandler = require('./middleware/errorHandler');


const setupSocket = require('./socket/socket');

const app = express();
const server = http.createServer(app);


connectDB();


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


app.use(session(sessionConfig));
app.use(adminSessionHandler);


app.use(flash());
app.use(passport.initialize());
app.use(passport.session());


app.use(setUserLocals);


app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));


app.use('/', userRoute);
app.use('/admin', adminRoutes);


setupSocket(server);


app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
