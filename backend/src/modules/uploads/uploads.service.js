// All image file access goes through this file, so local storage can later be swapped for cloud storage.
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');

const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'uploads'); // backend/uploads
const UPLOAD_URL_PREFIX = '/uploads';

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

// Saves the image under a random file name and returns its public URL path, e.g. /uploads/<uuid>.jpg
async function saveImage(buffer, extension) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const fileName = `${crypto.randomUUID()}.${extension}`;
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer);
  return `${UPLOAD_URL_PREFIX}/${fileName}`;
}

// Deletes an image by the URL returned from saveImage. Missing files are ignored.
async function deleteImage(imageUrl) {
  const fileName = path.basename(imageUrl); // never follow paths from outside the upload folder
  await fs.rm(path.join(UPLOAD_DIR, fileName), { force: true });
}

// Middleware that serves saved images at /uploads/<file name>.
const serveImages = express.static(UPLOAD_DIR);

module.exports = { UPLOAD_DIR, UPLOAD_URL_PREFIX, detectImageType, saveImage, deleteImage, serveImages };
