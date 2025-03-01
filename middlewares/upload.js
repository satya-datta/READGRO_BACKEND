const path = require('path');
const multer = require('multer');

// Set up storage for Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', '..', 'uploads'); // Path relative to the project root
    cb(null, uploadPath); // Save images in the uploads folder
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // Get file extension
    const filename = Date.now() + ext; // Unique filename using timestamp
    cb(null, filename);
  },
});

const upload = multer({ 
  storage: storage, 
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

module.exports = upload;
