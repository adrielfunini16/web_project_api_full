const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const winston = require('winston');
const mongoose = require('mongoose');
const { celebrate, Joi } = require('celebrate');
const errorHandler = require('../middlewares/errorHandler');
const UnauthorizedError = require('../errors/UnauthorizedError');
const ForbiddenError = require('../errors/ForbiddenError');

const prefix = `/auditoria-${randomUUID()}`;
const secrets = {
  password: 'senha-ficticia-auditoria-123',
  hash: '$2b$10$hashFicticioNuncaUsadoEmAutenticacao',
  email: 'pessoa-ficticia-auditoria@example.com',
  cookie: 'cookie-ficticio-auditoria',
  secret: 'segredo-ficticio-auditoria',
  internal: 'excecao-interna-ficticia-auditoria',
  id: 'identificador-pessoal-ficticio',
};
const token = jwt.sign({ email: secrets.email }, secrets.secret);
let logger;
let app;

function records(filename) {
  const fullPath = path.join(__dirname, '..', filename);
  if (!fs.existsSync(fullPath)) return [];
  // Inspeciona somente registros desta execução, sem imprimir logs anteriores.
  return fs
    .readFileSync(fullPath, 'utf8')
    .split('\n')
    .filter((line) => line.includes(prefix))
    .map((line) => JSON.parse(line));
}

async function waitForRecord(filename, route) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const found = records(filename).filter(
      (entry) => entry.meta.route === route,
    );
    if (found.length) return found;
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
  }
  throw new Error(`Registro de auditoria não encontrado em ${filename}`);
}

beforeAll(() => {
  const createLogger = winston.createLogger.bind(winston);
  const spy = jest
    .spyOn(winston, 'createLogger')
    .mockImplementation((options) => {
      logger = createLogger(options);
      return logger;
    });
  let middleware;
  try {
    middleware = require('../middlewares/logger');
  } finally {
    spy.mockRestore();
  }
  app = express();
  app.use(middleware.requestLogger);
  app.use(express.json());
  app.post(`${prefix}/success/:id`, (req, res) => {
    res.cookie('session', secrets.cookie).json({ ...secrets, token });
  });
  app.post(
    `${prefix}/celebrate`,
    celebrate({ body: Joi.object({ count: Joi.number().required() }) }),
    (req, res) => res.sendStatus(200),
  );
  const router = express.Router();
  router.get('/:id', (req, res, next) => next(new Error(secrets.internal)));
  app.use(`${prefix}/mounted`, router);
  const errors = [
    ['unauthorized', new UnauthorizedError()],
    ['forbidden', new ForbiddenError()],
    ['missing', new mongoose.Error.DocumentNotFoundError({})],
    [
      'conflict',
      Object.assign(new Error(secrets.internal), {
        name: 'MongoServerError',
        code: 11000,
      }),
    ],
    ['internal', new Error(secrets.internal)],
  ];
  errors.forEach(([name, error]) => {
    app.get(`${prefix}/${name}`, (req, res, next) => next(error));
  });
  app.use(middleware.errorLogger);
  app.use(errorHandler);
});

afterAll(() => {
  logger.close();
});

test('log de sucesso contém metadados JSON, sem dados sensíveis de entrada ou saída', async () => {
  const response = await request(app)
    .post(`${prefix}/success/${secrets.id}`)
    .query({ token, email: secrets.email })
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', `session=${secrets.cookie}`)
    .send(secrets);
  expect(response.status).toBe(200);
  const entries = await waitForRecord('request.log', `${prefix}/success/:id`);
  expect(entries).toHaveLength(1);
  const [entry] = entries;
  expect(Number.isNaN(Date.parse(entry.timestamp))).toBe(false);
  expect(entry.level).toBe('info');
  expect(entry.meta).toMatchObject({
    method: 'POST',
    status: 200,
    route: `${prefix}/success/:id`,
  });
  expect(typeof entry.meta.durationMs).toBe('number');
  expect(entry.meta.durationMs).toBeGreaterThanOrEqual(0);
  expect(entry.meta.category).toBeUndefined();
  const serialized = JSON.stringify(entry);
  Object.values(secrets)
    .concat(token, 'Authorization', 'Cookie', 'password')
    .forEach((value) => expect(serialized).not.toContain(value));
  expect(
    records('error.log').filter(
      (item) => item.meta.route === `${prefix}/success/:id`,
    ),
  ).toHaveLength(0);
});

test.each([
  ['unauthorized', 401, 'authentication'],
  ['forbidden', 403, 'authorization'],
  ['missing', 404, 'not_found'],
  ['conflict', 409, 'conflict'],
  ['internal', 500, 'internal'],
])(
  'registra %s uma vez em cada destino, sem detalhes internos',
  async (name, status, category) => {
    const response = await request(app)
      .get(`${prefix}/${name}`)
      .query({ secret: secrets.secret })
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(status);
    for (const filename of ['request.log', 'error.log']) {
      const entries = await waitForRecord(filename, `${prefix}/${name}`);
      expect(entries).toHaveLength(1);
      expect(entries[0].meta).toMatchObject({
        status,
        category,
        method: 'GET',
      });
      expect(entries[0].level).toBe(status >= 500 ? 'error' : 'warn');
      expect(Number.isNaN(Date.parse(entries[0].timestamp))).toBe(false);
      const serialized = JSON.stringify(entries);
      Object.values(secrets)
        .concat(token)
        .forEach((value) => expect(serialized).not.toContain(value));
    }
  },
);

test('erro Celebrate é classificado sem registrar o corpo inválido', async () => {
  const response = await request(app).post(`${prefix}/celebrate`).send(secrets);
  expect(response.status).toBe(400);
  for (const filename of ['request.log', 'error.log']) {
    const entries = await waitForRecord(filename, `${prefix}/celebrate`);
    expect(entries).toHaveLength(1);
    expect(entries[0].meta).toMatchObject({
      status: 400,
      category: 'validation',
    });
    Object.values(secrets).forEach((value) => expect(JSON.stringify(entries)).not.toContain(value));
  }
});

test('erro em Router preserva o padrão completo da rota, sem o ID recebido', async () => {
  const response = await request(app).get(`${prefix}/mounted/${secrets.id}`);
  expect(response.status).toBe(500);
  const entries = await waitForRecord('error.log', `${prefix}/mounted/:id`);
  expect(entries).toHaveLength(1);
  expect(JSON.stringify(entries)).not.toContain(secrets.id);
});
