require('dotenv').config({ quiet: true });

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');

test('crash-test não está registrado e retorna o tratamento normal de rota inexistente', async () => {
  // Verifica antes de enviar: uma regressão não deve derrubar o processo de testes.
  const routes = app.router.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
  expect(routes).not.toContain('/crash-test');
  const token = jwt.sign({ _id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
  const response = await request(app).get('/crash-test')
    .set('Authorization', `Bearer ${token}`);
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'A solicitação não foi encontrada' });
});

test.each(['/signup', '/signin'])('JSON malformado em %s mantém erro centralizado', async (path) => {
  const response = await request(app).post(path)
    .set('Content-Type', 'application/json').send('{"email":');
  expect(response.status).toBe(400);
  expect(response.body).toEqual({ message: 'Dados inválidos fornecidos' });
});
