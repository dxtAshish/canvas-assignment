'use strict';

const uploadService = require('../services/upload.service');
const { IMAGE } = require('../constants/limits');
const ApiError = require('../utils/ApiError');

async function uploadImage(req, res) {
  const upload = await uploadService.saveImage(req.user.id, req.file);
  res.status(201).json({ data: upload });
}

/** Streams an uploaded image to its owner only. */
async function serveImage(req, res) {
  const match = `/uploads/${req.params.name}`.match(IMAGE.URL_PATTERN);
  if (!match) throw ApiError.notFound('Image not found.');

  const { filePath, mimeType } = await uploadService.resolveOwnedFile(match[1], req.user.id);
  res.set({
    'Content-Type': mimeType,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=86400',
  });
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Image not found.' } });
  });
}

module.exports = { uploadImage, serveImage };
