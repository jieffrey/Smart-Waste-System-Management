// Local disk storage (STORAGE_DRIVER=local, the default): files in backend/uploads, served at /uploads.
// For development and tests only: hosted containers lose this folder on every redeploy.
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');

const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'uploads'); // backend/uploads
const UPLOAD_URL_PREFIX = '/uploads';

// Saves the image under a random file name and returns its URL path, e.g. /uploads/<uuid>.jpg
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

module.exports = { UPLOAD_DIR, UPLOAD_URL_PREFIX, saveImage, deleteImage, serveImages };
