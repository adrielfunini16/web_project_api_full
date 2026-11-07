const jwt = require('jsonwebtoken');

const { JWT_SECRET } = process.env;
const UnauthorizedError = require('../errors/UnauthorizedError');

const auth = (req, res, next) => {
  const { authorization } = req.headers;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw new UnauthorizedError('Acesso não autorizado');
  }
  const token = authorization.replace('Bearer ', '');
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new UnauthorizedError('Token inválido');
  }

  req.user = { _id: decoded._id };

  next();
};

module.exports = auth;
