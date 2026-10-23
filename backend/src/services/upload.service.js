'use strict';

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/env');
const { IMAGE } = require('../constants/limits');
const uploadModel = require('../models/upload.model');
const ApiError = require('../utils/ApiError');

/**
 * Detects the real image type from the file's magic bytes. The client-supplied
 * MIME type and extension are never trusted (prevents e.g. HTML/SVG uploads).
 */
function detectImageMime(buffer) {
  if (buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  const head = buffer.subarray(0, 6).toString('ascii');
  if (head === 'GIF87a' || head === 'GIF89a') return 'image/gif';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

async function saveImage(userId, file) {
  if (!file) throw ApiError.badRequest('Please choose an image file to upload.', [{ field: 'image', message: 'Image file is required' }]);

  const mimeType = detectImageMime(file.buffer);
  if (!mimeType) {
    throw ApiError.validation('Unsupported image format.', [{ field: 'image', message: 'Only PNG, JPEG, GIF and WEBP images are allowed' }]);
  }

  const storedName = `${crypto.randomUUID()}.${IMAGE.MIME_TYPES[mimeType]}`;
  const target = path.join(config.uploads.dir, storedName);
  await fs.writeFile(target, file.buffer, { flag: 'wx' });

  try {
    const upload = await uploadModel.create({
      userId,
      storedName,
      originalName: path.basename(file.originalname || 'image').slice(0, 255),
      mimeType,
      sizeBytes: file.size,
    });
    return { ...upload, url: `/uploads/${storedName}` };
  } catch (err) {
    await fs.unlink(target).catch(() => {});
    throw err;
  }
}

/** Resolves an uploaded file path only if the requesting user owns it. */
async function resolveOwnedFile(storedName, userId) {
  const upload = await uploadModel.findByStoredNameForUser(storedName, userId);
  if (!upload) throw ApiError.notFound('Image not found.');
  return { filePath: path.join(config.uploads.dir, upload.storedName), mimeType: upload.mimeType };
}

module.exports = { saveImage, resolveOwnedFile, detectImageMime };
