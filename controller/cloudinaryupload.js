const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a buffer (e.g., from multer) to Cloudinary
 * @param {Buffer} buffer - Image buffer
 * @param {string} folder - Optional folder name
 * @returns {Promise<Object>} - Cloudinary result (e.g. { secure_url, public_id, ... })
 */
const uploadBufferToCloudinary = (buffer, folder = "uploads") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (result) resolve(result);
      else reject(error);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

module.exports = { uploadBufferToCloudinary };
