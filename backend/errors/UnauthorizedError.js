class UnauthorizedError extends Error {
  constructor(message = 'E-mail ou senha incorretos') {
    super(message);
    this.name = 'UnauthorizedError';
    this.status = 401;
  }
}

module.exports = UnauthorizedError;
