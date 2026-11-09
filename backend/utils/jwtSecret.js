function getJwtSecret() {
  const { NODE_ENV = 'development', JWT_SECRET } = process.env;

  if (!['development', 'test', 'production'].includes(NODE_ENV)) {
    throw new Error('NODE_ENV deve ser development, test ou production');
  }

  if (JWT_SECRET && JWT_SECRET.trim()) return JWT_SECRET;
  if (NODE_ENV === 'development') return 'around-development-only-secret';

  throw new Error('JWT_SECRET precisa estar configurado para testes e produção');
}

module.exports = getJwtSecret;
