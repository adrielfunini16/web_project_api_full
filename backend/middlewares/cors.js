const cors = require('cors');

const defaultOrigin = process.env.NODE_ENV === 'production'
  ? 'https://around.clux.com'
  : 'http://localhost:5173';

// CORS_ORIGINS aceita origens separadas por vírgula e substitui o padrão do ambiente.
const allowedOrigins = (process.env.CORS_ORIGINS || defaultOrigin)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = cors({
  origin(origin, callback) {
    callback(null, allowedOrigins.includes(origin));
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  optionsSuccessStatus: 204,
});
