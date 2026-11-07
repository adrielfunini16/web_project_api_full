/** @jest-environment node */

require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const request = require('supertest');
const app = require('../app');
const User = require('../models/user');

const { MONGO_URI } = process.env;
const runId = randomUUID();
const emails = [`users-a-${runId}@example.com`, `users-b-${runId}@example.com`];
const profile = {
  name: 'Usuario de teste',
  about: 'Perfil inicial',
  avatar: 'https://example.com/avatar.jpg',
};
let databaseAuthorized = false;
let currentUser;
let otherUser;

async function registerAndLogin(email) {
  const credentials = { email, password: 'UsersTestPassword123' };
  const signup = await request(app).post('/signup').send({ ...profile, ...credentials });
  expect(signup.status).toBe(201);
  expect(signup.body).toHaveProperty('_id');
  const signin = await request(app).post('/signin').send(credentials);
  expect(signin.status).toBe(200);
  expect(typeof signin.body.token).toBe('string');
  expect(signin.body.token.length).toBeGreaterThan(0);
  return { id: signup.body._id, email, token: signin.body.token };
}

function expectUser(body, user, fields = profile) {
  expect(body).toEqual(expect.objectContaining({ _id: user.id, email: user.email, ...fields }));
  expect(body).not.toHaveProperty('password');
}

async function expectInternalError(method, path, operation, body) {
  const before = await User.find({ email: { $in: emails } }).lean();
  const spy = jest.spyOn(User, operation);
  const failure = new Error('Falha interna simulada');
  if (operation === 'find') {
    spy.mockRejectedValueOnce(failure);
  } else {
    spy.mockReturnValueOnce({ orFail: jest.fn().mockRejectedValueOnce(failure) });
  }
  try {
    const req = request(app)[method](path)
      .set('Authorization', `Bearer ${currentUser.token}`);
    if (body) req.send(body);
    const response = await req;
    expect(spy).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Ocorreu um erro no servidor' });
  } finally {
    spy.mockRestore();
  }
  expect(await User.find({ email: { $in: emails } }).lean()).toEqual(before);
}

beforeAll(async () => {
  if (MONGO_URI !== 'mongodb://127.0.0.1:27017/around_test') {
    throw new Error('MONGO_URI não corresponde ao banco de testes autorizado');
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET precisa estar configurado para os testes');
  }
  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 3000,
    runtimeAdapters: {
      os: require('os'),
    },
  });

  databaseAuthorized = true;
  currentUser = await registerAndLogin(emails[0]);
  otherUser = await registerAndLogin(emails[1]);
});

beforeEach(async () => {
  // Restaura somente os perfis exclusivos desta suíte para evitar dependência de ordem.
  if (databaseAuthorized) {
    await User.updateMany({ email: { $in: emails } }, { $set: profile });
  }
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  jest.restoreAllMocks();
  try {
    if (databaseAuthorized) {
      await User.deleteMany({ email: { $in: emails } });
    }
  } finally {
    await mongoose.disconnect();
  }
});

describe('GET /users', () => {
  test('retorna 200 e um array com os usuários cadastrados, sem senhas', async () => {
    const response = await request(app).get('/users')
      .set('Authorization', `Bearer ${currentUser.token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    for (const user of [currentUser, otherUser]) {
      expectUser(response.body.find((item) => item._id === user.id), user);
    }
    response.body.forEach((user) => expect(user).not.toHaveProperty('password'));
  });

  test.each([
    ['sem JWT', null, 'Acesso não autorizado'],
    ['com JWT inválido', 'jwt-invalido', 'Token inválido'],
  ])('retorna 401 %s', async (label, token, message) => {
    const req = request(app).get('/users');
    if (token) req.set('Authorization', `Bearer ${token}`);
    const response = await req;
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message });
  });

  test('retorna 500 quando a consulta falha', async () => {
    await expectInternalError('get', '/users', 'find');
  });
});

describe('GET /users/me', () => {
  test('retorna 200 com a identidade do JWT e sem expor a senha', async () => {
    const response = await request(app).get('/users/me')
      .set('Authorization', `Bearer ${currentUser.token}`);
    expect(response.status).toBe(200);
    expectUser(response.body, currentUser);
  });

  test.each([
    ['sem JWT', null, 'Acesso não autorizado'],
    ['com JWT inválido', 'jwt-invalido', 'Token inválido'],
  ])('retorna 401 %s', async (label, token, message) => {
    const req = request(app).get('/users/me');
    if (token) req.set('Authorization', `Bearer ${token}`);
    const response = await req;
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message });
  });

  test('retorna 404 quando o usuário do JWT deixou de existir', async () => {
    // Usuário temporário independente: não invalida as fixtures dos demais testes.
    const email = `users-removed-${randomUUID()}@example.com`;
    emails.push(email);
    const removed = await registerAndLogin(email);
    await User.deleteOne({ _id: removed.id, email });
    const response = await request(app).get('/users/me')
      .set('Authorization', `Bearer ${removed.token}`);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'ID não encontrado' });
  });

  test('retorna 500 quando a consulta falha', async () => {
    await expectInternalError('get', '/users/me', 'findById');
  });
});

describe('GET /users/:userId', () => {
  test('retorna 200 com o usuário solicitado pelo ID, sem senha', async () => {
    const response = await request(app).get(`/users/${otherUser.id}`)
      .set('Authorization', `Bearer ${currentUser.token}`);
    expect(response.status).toBe(200);
    expectUser(response.body, otherUser);
  });

  test('retorna 400 para ID inválido', async () => {
    const response = await request(app).get('/users/id-invalido')
      .set('Authorization', `Bearer ${currentUser.token}`);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Dados inválidos fornecidos' });
  });

  test('retorna 404 para ID válido inexistente', async () => {
    const id = new mongoose.Types.ObjectId();
    expect(await User.exists({ _id: id })).toBeNull();
    const response = await request(app).get(`/users/${id}`)
      .set('Authorization', `Bearer ${currentUser.token}`);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'ID não encontrado' });
  });

  test('retorna 401 sem JWT', async () => {
    const response = await request(app).get(`/users/${otherUser.id}`);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Acesso não autorizado' });
  });

  test('retorna 500 quando a consulta falha', async () => {
    await expectInternalError('get', `/users/${otherUser.id}`, 'findById');
  });
});

describe('PATCH /users/me', () => {
  const update = { name: 'Nome atualizado', about: 'Perfil atualizado' };

  test('atualiza e persiste apenas o perfil do usuário autenticado', async () => {
    const otherBefore = await User.findById(otherUser.id).lean();
    const response = await request(app).patch('/users/me')
      .set('Authorization', `Bearer ${currentUser.token}`).send(update);
    expect(response.status).toBe(200);
    expectUser(response.body, currentUser, { ...profile, ...update });
    expect(await User.findById(currentUser.id).lean()).toEqual(expect.objectContaining(update));
    expect(await User.findById(otherUser.id).lean()).toEqual(otherBefore);
  });

  test.each([
    ['nome ausente', { about: 'Descricao valida' }],
    ['about ausente', { name: 'Nome valido' }],
    ['nome curto', { name: 'A', about: 'Descricao valida' }],
    ['about longo', { name: 'Nome valido', about: 'A'.repeat(31) }],
  ])('retorna 400 sem persistir com %s', async (label, payload) => {
    const before = await User.findById(currentUser.id).lean();
    const response = await request(app).patch('/users/me')
      .set('Authorization', `Bearer ${currentUser.token}`).send(payload);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Dados inválidos fornecidos' });
    expect(await User.findById(currentUser.id).lean()).toEqual(before);
  });

  test('rejeita tentativa de fornecer o ID de outro usuário no corpo', async () => {
    const before = await User.find({ email: { $in: emails } }).lean();
    const response = await request(app).patch('/users/me')
      .set('Authorization', `Bearer ${currentUser.token}`)
      .send({ ...update, _id: otherUser.id });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Dados inválidos fornecidos' });
    expect(await User.find({ email: { $in: emails } }).lean()).toEqual(before);
  });

  test('retorna 401 sem JWT e preserva os perfis', async () => {
    const before = await User.find({ email: { $in: emails } }).lean();
    const response = await request(app).patch('/users/me').send(update);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Acesso não autorizado' });
    expect(await User.find({ email: { $in: emails } }).lean()).toEqual(before);
  });

  test('retorna 500 sem alterações quando a atualização falha', async () => {
    await expectInternalError('patch', '/users/me', 'findByIdAndUpdate', update);
  });
});

describe('PATCH /users/me/avatar', () => {
  const update = { avatar: 'https://example.com/novo-avatar.jpg' };

  test('atualiza e persiste o avatar somente do usuário autenticado', async () => {
    const otherBefore = await User.findById(otherUser.id).lean();
    const response = await request(app).patch('/users/me/avatar')
      .set('Authorization', `Bearer ${currentUser.token}`).send(update);
    expect(response.status).toBe(200);
    expectUser(response.body, currentUser, { ...profile, ...update });
    expect((await User.findById(currentUser.id)).avatar).toBe(update.avatar);
    expect(await User.findById(otherUser.id).lean()).toEqual(otherBefore);
  });

  test.each([
    ['URL inválida', { avatar: 'nao-e-url' }],
    ['avatar ausente', {}],
  ])('retorna 400 sem alterações com %s', async (label, payload) => {
    const before = await User.findById(currentUser.id).lean();
    const response = await request(app).patch('/users/me/avatar')
      .set('Authorization', `Bearer ${currentUser.token}`).send(payload);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Dados inválidos fornecidos' });
    expect(await User.findById(currentUser.id).lean()).toEqual(before);
  });

  test('retorna 401 sem JWT e preserva os perfis', async () => {
    const before = await User.find({ email: { $in: emails } }).lean();
    const response = await request(app).patch('/users/me/avatar').send(update);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Acesso não autorizado' });
    expect(await User.find({ email: { $in: emails } }).lean()).toEqual(before);
  });

  test('retorna 500 sem alterações quando a atualização falha', async () => {
    await expectInternalError('patch', '/users/me/avatar', 'findByIdAndUpdate', update);
  });
});
