
const multer = require('multer');
const path = require('path');

// Disk storage for profile pictures and simple uploads
const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

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

// Two uploaders: disk and memory
const diskUpload = multer({
  storage: diskStorage,
  limits: { fileSize: 1024 * 1024 * 15 },
  fileFilter
});

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 15 },
  fileFilter
});

module.exports = { diskUpload, memoryUpload };
