'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const userModel = require('../models/user.model');
const ApiError = require('../utils/ApiError');

const BCRYPT_ROUNDS = 12;
// Compared against when the email is unknown so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-password', BCRYPT_ROUNDS);

async function register({ name, email, password }) {
  const existing = await userModel.findByEmailWithPassword(email);
  if (existing) throw ApiError.conflict('An account with this email already exists.', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    return await userModel.create({ name, email, passwordHash });
  } catch (err) {
    // Handles the race where two registrations with the same email arrive together.
    if (err.code === 'ER_DUP_ENTRY') throw ApiError.conflict('An account with this email already exists.', 'EMAIL_TAKEN');
    throw err;
  }
}

async function login({ email, password }) {
  const user = await userModel.findByEmailWithPassword(email);
  const valid = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !valid) throw ApiError.unauthorized('Invalid email or password.');

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function signToken(user) {
  return jwt.sign({ sub: String(user.id) }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    algorithm: 'HS256',
  });
}

/** Returns the user id from a valid token, or null for missing/invalid/expired tokens. */
function verifyToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
    const id = Number(payload.sub);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

module.exports = { register, login, signToken, verifyToken };
