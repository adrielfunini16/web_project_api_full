const path = require('path');
const winston = require('winston');
const expressWinston = require('express-winston');
const { isCelebrateError } = require('celebrate');

const logger = winston.createLogger({
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: path.join(__dirname, '../request.log') }),
    new winston.transports.File({
      filename: path.join(__dirname, '../error.log'),
      level: 'warn',
    }),
  ],
});

// Falhas de escrita não devem encerrar o processo nem revelar detalhes internos.
logger.on('error', () => {
  console.error('Não foi possível gravar o log HTTP');
});

const requestLogger = expressWinston.logger({
  winstonInstance: logger,
  statusLevels: true,
  msg: 'HTTP request',
  requestWhitelist: [],
  responseWhitelist: [],
  requestField: null,
  responseField: null,
  dynamicMeta(req, res) {
    return {
      method: req.method,
      // Usa o padrão da rota, nunca a URL recebida, IDs ou query strings.
      route: req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched',
      status: res.statusCode,
      durationMs: res.responseTime,
      ...(res.statusCode >= 400 && {
        category: res.locals.logErrorCategory || 'http_error',
      }),
    };
  },
});

// Apenas classifica: a gravação ocorre uma vez, após o status final da resposta.
const errorLogger = (err, req, res, next) => {
  const categories = {
    ValidationError: 'validation',
    CastError: 'validation',
    UnauthorizedError: 'authentication',
    ForbiddenError: 'authorization',
    DocumentNotFoundError: 'not_found',
  };
  if (isCelebrateError(err) || err.type === 'entity.parse.failed') {
    res.locals.logErrorCategory = 'validation';
  } else if (err.name === 'MongoServerError' && err.code === 11000) {
    res.locals.logErrorCategory = 'conflict';
  } else {
    res.locals.logErrorCategory = Object.prototype.hasOwnProperty.call(categories, err.name)
      ? categories[err.name] : 'internal';
  }
  next(err);
};

module.exports = { requestLogger, errorLogger };
