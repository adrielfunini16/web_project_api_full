class ForbiddenError extends Error {
  constructor(message = 'Você não tem permissão para excluir este cartão') {
    super(message);
    this.name = 'ForbiddenError';
    this.status = 403;
  }
}

module.exports = ForbiddenError;
