const express = require('express');
const request = require('supertest');

// As substituições afetam somente este processo de testes, nunca o arquivo .env.
const originalEnv = process.env;
let app;

function loadCors(environment, origins) {
  process.env = { ...originalEnv, NODE_ENV: environment };
  delete process.env.CORS_ORIGINS;
  if (origins !== undefined) process.env.CORS_ORIGINS = origins;
  let middleware;
  jest.isolateModules(() => {
    middleware = require('../middlewares/cors');
  });
  const server = express();
  server.use(middleware);
  server.use((req, res) => res.sendStatus(200));
  return server;
}

afterEach(() => {
  process.env = originalEnv;
});

describe('CORS: política de origens', () => {
  test.each([
    ['development', 'http://localhost:5173'],
    ['production', 'https://around.clux.com'],
  ])('permite a origem padrão em %s', async (environment, origin) => {
    const response = await request(loadCors(environment)).get('/').set('Origin', origin);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    expect(response.headers.vary).toContain('Origin');
  });

  test.each([
    ['production', 'http://localhost:5173'],
    ['development', 'https://around.clux.com'],
    ['development', 'https://intruso.example'],
    ['development', 'http://localhost:5173.intruso.example'],
  ])('omite cabeçalhos para %s / %s', async (environment, origin) => {
    const response = await request(loadCors(environment)).get('/').set('Origin', origin);
    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('CORS_ORIGINS substitui o padrão e aceita lista com espaços', async () => {
    const server = loadCors('production', ' https://um.example, https://dois.example, ');
    for (const origin of ['https://um.example', 'https://dois.example']) {
      const response = await request(server).get('/').set('Origin', origin);
      expect(response.headers['access-control-allow-origin']).toBe(origin);
    }
    const response = await request(server).get('/').set('Origin', 'https://around.clux.com');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('requisição sem Origin continua acessível, sem permissão CORS', async () => {
    const response = await request(loadCors('development')).get('/');
    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('CORS no app real, sem conexão ao banco', () => {
  beforeAll(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    delete process.env.CORS_ORIGINS;
    app = require('../app');
    process.env = originalEnv;
  });

  test('preflight precede JWT e anuncia métodos e cabeçalhos esperados', async () => {
    const response = await request(app).options('/cards/507f1f77bcf86cd799439011')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'DELETE')
      .set('Access-Control-Request-Headers', 'Authorization,Content-Type');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-methods'].split(',')).toEqual([
      'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS',
    ]);
    expect(response.headers['access-control-allow-headers'].toLowerCase().split(','))
      .toEqual(['authorization', 'content-type']);
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  test('preflight de origem não autorizada não recebe permissão CORS', async () => {
    const response = await request(app).options('/cards')
      .set('Origin', 'https://intruso.example')
      .set('Access-Control-Request-Method', 'DELETE');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-methods']).toBeUndefined();
  });

  test.each(['/signup', '/signin'])('rota pública %s chega à validação sem JWT', async (route) => {
    const response = await request(app).post(route)
      .set('Origin', 'http://localhost:5173').send({});
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Dados inválidos fornecidos' });
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  test.each(['/users', '/cards'])('rota privada %s continua exigindo JWT', async (route) => {
    const response = await request(app).get(route).set('Origin', 'http://localhost:5173');
    expect(response.status).toBe(401);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
