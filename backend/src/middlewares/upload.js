const multer = require('multer');
const { detectImageType } = require('../modules/uploads/uploads.service');
const HttpError = require('../utils/http-error');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

// Keeps the upload in memory (not on disk) until it has been validated and classified.
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
}).single('image');

// Runs multer and turns its errors into HttpErrors, so the central error handler returns 400/413 (not 500).
function parseImage(req, res, next) {
  multerUpload(req, res, (err) => {
    if (!err) {
      return next();
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpError(413, 'Image must be 5 MB or smaller'));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new HttpError(400, 'Upload the image in the "image" field'));
    }
    next(new HttpError(400, 'Invalid upload')); // other multer errors or a malformed multipart body
  });
}

function checkImage(req, res, next) {
  if (!req.file) {
    throw new HttpError(400, 'Validation failed', [{ field: 'image', message: 'Image is required' }]);
  }

  const imageType = detectImageType(req.file.buffer);
  if (!imageType) {
    throw new HttpError(415, 'Unsupported file type. Upload a JPEG, PNG or WebP image');
  }

  req.image = { buffer: req.file.buffer, ...imageType };
  next();
}

// Reads one image from the multipart field "image" and sets req.image = { buffer, extension, mimeType }.
const uploadImage = [parseImage, checkImage];

module.exports = { uploadImage, MAX_IMAGE_BYTES };
