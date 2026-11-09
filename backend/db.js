const mongoose = require('mongoose');

function getMongoUri() {
  const { NODE_ENV = 'development', MONGO_URI } = process.env;
  // MONGO_URI do .env local pertence aos testes, nunca ao servidor de desenvolvimento.
  if (NODE_ENV === 'development') return 'mongodb://127.0.0.1:27017/arounddb';

  if (NODE_ENV === 'test') {
    if (MONGO_URI !== 'mongodb://127.0.0.1:27017/around_test') {
      throw new Error('MONGO_URI não corresponde ao banco de testes autorizado');
    }
    return MONGO_URI;
  }

  if (NODE_ENV === 'production') {
    const match = MONGO_URI && MONGO_URI.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)(?:\?|$)/);
    if (!match) {
      throw new Error('Produção exige MONGO_URI com um banco explicitamente definido');
    }
    const database = decodeURIComponent(match[1]).toLowerCase();
    if (['aroundb', 'arounddb', 'around_test'].includes(database)) {
      throw new Error('Produção não pode utilizar bancos de desenvolvimento ou testes');
    }
    return MONGO_URI;
  }

  throw new Error('NODE_ENV deve ser development, test ou production');
}

async function mongooseConnect() {
  const uri = getMongoUri();
  try {
    await mongoose.connect(uri);
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
    throw err;
  }
}

module.exports = mongooseConnect;
