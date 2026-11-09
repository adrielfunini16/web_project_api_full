const jwt = require('jsonwebtoken');

const getJwtSecret = require('../utils/jwtSecret');
const UnauthorizedError = require('../errors/UnauthorizedError');

const auth = (req, res, next) => {
  const { authorization } = req.headers;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw new UnauthorizedError('Acesso não autorizado');
  }
  const token = authorization.replace('Bearer ', '');
  let decoded;
  try {
    decoded = jwt.verify(token, getJwtSecret());
  } catch (error) {
    throw new UnauthorizedError('Token inválido');
  }

  req.user = { _id: decoded._id };

  next();
};

module.exports = auth;
