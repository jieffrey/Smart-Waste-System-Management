// All image handling goes through this file: type detection, sanitizing, and storage. The storage driver is
// chosen by STORAGE_DRIVER: 'local' (backend/uploads, default) or 'cloudinary' (production).
const sharp = require('sharp');
const { storageDriver, cloudinaryFolder } = require('../../config/env');
const localStorage = require('./storage.local');
const { createDefaultCloudinaryStorage } = require('./storage.cloudinary');
const HttpError = require('../../utils/http-error');

const { UPLOAD_DIR, UPLOAD_URL_PREFIX } = localStorage;
// Same pixel limit as the ML API (24 MP), so sharp never decodes a "decompression bomb".
const MAX_IMAGE_PIXELS = 24_000_000;
const IMAGE_REJECTED_MESSAGE = "The photo couldn't be processed. Try another photo.";

const storage = storageDriver === 'cloudinary' ? createDefaultCloudinaryStorage(cloudinaryFolder) : localStorage;

// Detects the real image type from the file's first bytes (the client's content type is not trusted).
function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: 'jpg', mimeType: 'image/jpeg' };
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: 'png', mimeType: 'image/png' };
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { extension: 'webp', mimeType: 'image/webp' };
  }
  return null;
}

// Re-encodes the image without any metadata (EXIF incl. GPS, XMP, IPTC, ICC: SEC-06). The EXIF orientation is
// applied to the pixels first, so the photo still shows the right way up. Same format as the upload.
async function sanitizeImage({ buffer, extension, mimeType }) {
  try {
    const image = sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'error' }).rotate();
    const encoded =
      extension === 'png' ? image.png() : extension === 'webp' ? image.webp({ quality: 85 }) : image.jpeg({ quality: 85 });
    return { buffer: await encoded.toBuffer(), extension, mimeType };
  } catch (err) {
    console.warn(`Image could not be sanitized: ${err.message}`);
    throw new HttpError(422, IMAGE_REJECTED_MESSAGE, [{ field: 'image', message: IMAGE_REJECTED_MESSAGE }]);
  }
}

// Stores the image and returns the value for waste_reports.image_url: "/uploads/<uuid>.<ext>" (local) or the
// https secure_url (Cloudinary).
async function saveImage(buffer, extension) {
  try {
    return await storage.saveImage(buffer, extension);
  } catch (err) {
    console.error(`Image storage failed: ${err.message}`);
    throw new HttpError(503, 'Photo storage unavailable, please try again later', null);
  }
}

// Deletes an image by the URL returned from saveImage. Missing images are ignored.
function deleteImage(imageUrl) {
  return storage.deleteImage(imageUrl);
}

// Serves local images at /uploads. With Cloudinary nothing is mounted (images come from res.cloudinary.com).
const serveImages = storageDriver === 'local' ? localStorage.serveImages : null;

module.exports = {
  UPLOAD_DIR,
  UPLOAD_URL_PREFIX,
  detectImageType,
  sanitizeImage,
  saveImage,
  deleteImage,
  serveImages,
};
