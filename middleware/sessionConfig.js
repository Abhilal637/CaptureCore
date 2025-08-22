require('dotenv').config();

module.exports = {
  secret: process.env.SESSION_SECRET ,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 1000 * 60 * 60 * 24
  },
  rolling: true
};
