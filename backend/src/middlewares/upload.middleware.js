'use strict';

const multer = require('multer');
const config = require('../config/env');
const { IMAGE } = require('../constants/limits');
const ApiError = require('../utils/ApiError');

/**
 * Files are buffered in memory (bounded by `fileSize`) so their magic bytes can
 * be verified before anything is written to disk.
 */
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploads.maxBytes, files: 1, fields: 5 },
  fileFilter: (_req, file, cb) => {
    if (!Object.hasOwn(IMAGE.MIME_TYPES, file.mimetype)) {
      return cb(ApiError.validation('Unsupported image format.', [{
        field: 'image', message: 'Only PNG, JPEG, GIF and WEBP images are allowed',
      }]));
    }
    return cb(null, true);
  },
});

module.exports = { singleImage: imageUpload.single('image') };
