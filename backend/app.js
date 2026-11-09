const express = require('express');
const cors = require('./middlewares/cors');
const { requestLogger, errorLogger } = require('./middlewares/logger');
const usersRouter = require('./routes/users');
const { createUser, login } = require('./controllers/users');
const cardsRouter = require('./routes/cards');
const errorHandler = require('./middlewares/errorHandler');
const notFoundHandler = require('./middlewares/notFoundHandler');
const auth = require('./middlewares/auth');

const app = express();
const {
  validationSignup,
  validationSignin,
} = require('./middlewares/validation');

app.use(requestLogger);
app.use(cors);
app.use(express.json());
// Temporária para a revisão TripleTen; remover após a aprovação.
app.get('/crash-test', () => {
  setTimeout(() => {
    throw new Error('O servidor travará agora');
  }, 0);
});
app.post('/signup', validationSignup, createUser);
app.post('/signin', validationSignin, login);
app.use(auth);
app.use('/cards', cardsRouter);
app.use('/users', usersRouter);
app.use(notFoundHandler);
app.use(errorLogger);
app.use(errorHandler);

module.exports = app;
