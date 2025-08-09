
const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage(); // <-- CHANGED here

const fileTypes = /jpeg|jpg|png|gif/;

const fileFilter = (req, file, cb) => {
  const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = fileTypes.test(file.mimetype);
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Error: File upload only supports the following filetypes - ' + fileTypes));
  }
};

const upload = multer({
  storage, 
  limits: { fileSize: 1024 * 1024 * 15 }, // 15MB
  fileFilter
});

module.exports = upload;
