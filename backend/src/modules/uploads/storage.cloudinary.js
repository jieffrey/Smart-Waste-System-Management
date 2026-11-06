// Cloudinary storage (STORAGE_DRIVER=cloudinary, production): the photo is uploaded and its https
// secure_url is stored in waste_reports.image_url. The SDK reads CLOUDINARY_URL from the environment.
const crypto = require('node:crypto');

// public_id = "<folder>/<uuid>", so the id can be read back from the stored URL (no extra DB column).
// A Cloudinary delivery URL looks like https://res.cloudinary.com/<cloud>/image/upload/v<version>/<public_id>.<ext>
const DELIVERY_URL = /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i;

// Returns the public_id of an image URL in our folder, or null for anything else (never deleted).
function publicIdFromUrl(imageUrl, folder) {
  const match = DELIVERY_URL.exec(imageUrl || '');
  if (!match) {
    return null;
  }
  const publicId = match[1];
  const prefix = `${folder}/`;
  const rest = publicId.slice(prefix.length);
  return publicId.startsWith(prefix) && /^[0-9a-f-]{36}$/.test(rest) ? publicId : null;
}

// `uploader` is cloudinary.v2.uploader (tests pass a stub with the same two methods).
function createCloudinaryStorage({ uploader, folder }) {
  function saveImage(buffer) {
    return new Promise((resolve, reject) => {
      const stream = uploader.upload_stream(
        {
          // The full id is given (instead of the `folder` option), so it is the same in Cloudinary's fixed and
          // dynamic folder modes; asset_folder places it in that folder in the Media Library.
          public_id: `${folder}/${crypto.randomUUID()}`,
          asset_folder: folder,
          resource_type: 'image',
          type: 'upload',
          overwrite: false,
          unique_filename: false,
        },
        (err, result) => (err ? reject(err) : resolve(result.secure_url))
      );
      stream.end(buffer);
    });
  }

  async function deleteImage(imageUrl) {
    const publicId = publicIdFromUrl(imageUrl, folder);
    if (!publicId) {
      return;
    }
    // "not found" comes back as a normal result, not an error, so a missing asset is ignored like a missing file.
    await uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  }

  return { saveImage, deleteImage };
}

// The real SDK is only loaded when this driver is used.
function createDefaultCloudinaryStorage(folder) {
  const { v2: cloudinary } = require('cloudinary');
  cloudinary.config({ secure: true });
  return createCloudinaryStorage({ uploader: cloudinary.uploader, folder });
}

module.exports = { createCloudinaryStorage, createDefaultCloudinaryStorage, publicIdFromUrl };
