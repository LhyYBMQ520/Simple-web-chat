const path = require('path');

const UID_LIFETIME = 24 * 60 * 60 * 1000;
const PORT = 21451;
const DB_DIR = path.join(__dirname, '..', '..', 'db');
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

module.exports = {
  UID_LIFETIME,
  PORT,
  DB_DIR,
  PUBLIC_DIR
};
