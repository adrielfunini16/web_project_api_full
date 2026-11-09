require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/user');

const { MONGO_URI } = process.env;

// Evita conflitos entre diferentes execuções dos testes.
const runId = `${Date.now()}-${process.pid}`;

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
});

afterAll(async () => {
  await mongoose.disconnect();
});

// Dados fictícios para os testes
const newUser = {
  name: 'Test User',
  about: 'Test About',
  avatar: 'https://example.com/avatar.jpg',
  email: `test-${runId}@example.com`,
  password: 'TestPassword123',
};

const invalidUser = {
  name: '',
  about: '',
  avatar: '',
  email: '',
  password: '',
};

// =======================================
// TESTE 201 - REGISTRO COM SUCESSO
// =======================================

describe('POST /signup', () => {
  let createdUserId = null;

  afterEach(async () => {
    if (createdUserId) {
      await User.deleteOne({ _id: createdUserId });
      createdUserId = null;
    }
  });

  test('should return status 201 and the created user', async () => {
    const response = await request(app).post('/signup').send(newUser);

    // Guardar o ID retornado pelo servidor
    createdUserId = response.body._id;

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('_id');
    expect(response.body).toHaveProperty('name', newUser.name);
    expect(response.body).toHaveProperty('about', newUser.about);
    expect(response.body).toHaveProperty('avatar', newUser.avatar);
    expect(response.body).toHaveProperty('email', newUser.email);
    expect(response.body).not.toHaveProperty('password');
  });
});

// =======================================
// TESTE 400 - DADOS INVÁLIDOS
// TESTE 409 - EMAIL DUPLICADO
// =======================================

describe('POST /signup with invalid data', () => {
  let duplicateUserId = null;

  afterEach(async () => {
    if (duplicateUserId) {
      await User.deleteOne({ _id: duplicateUserId });
      duplicateUserId = null;
    }
  });

  test('should return status 400 for invalid data', async () => {
    const response = await request(app).post('/signup').send(invalidUser);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty(
      'message',
      'Dados inválidos fornecidos',
    );
  });

  test('should return status 409 for duplicate email', async () => {
    const anotherUser = {
      name: 'Another User',
      about: 'Another About',
      avatar: 'https://example.com/avatar2.jpg',
      email: `another-${runId}@example.com`,
      password: 'AnotherPassword123',
    };

    // Primeiro cadastro: deve funcionar normalmente
    const firstResponse = await request(app).post('/signup').send(anotherUser);

    duplicateUserId = firstResponse.body._id;

    expect(firstResponse.status).toBe(201);

    // Segundo cadastro: mesmo email, deve retornar 409
    const secondResponse = await request(app).post('/signup').send(anotherUser);

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body).toHaveProperty('message', 'Conflito de dados');
  });
});

// =======================================
// TESTE 500 - ERRO INTERNO DO SERVIDOR
// =======================================

describe('POST /signup with internal server error', () => {
  test('should return status 500 for internal error', async () => {
    // Simular uma falha inesperada na criação do usuário
    const createSpy = jest
      .spyOn(User, 'create')
      .mockRejectedValueOnce(new Error('Falha interna simulada'));

    try {
      const response = await request(app).post('/signup').send(newUser);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty(
        'message',
        'Ocorreu um erro no servidor',
      );
    } finally {
      // Restaurar o método original, mesmo se o teste falhar
      createSpy.mockRestore();
    }
  });
});

// =======================================
// TESTE 200 - LOGIN COM SUCESSO
// =======================================

describe('POST /signin', () => {
  let createdUserId = null;

  beforeEach(async () => {
    // Criar um usuário para o teste de login
    const response = await request(app).post('/signup').send(newUser);
    expect(response.status).toBe(201);
    createdUserId = response.body._id;
  });

  afterEach(async () => {
    // Limpar o usuário criado após cada teste
    if (createdUserId) {
      await User.deleteOne({ _id: createdUserId });
      createdUserId = null;
    }
  });

  test('should return status 200 and a token for valid credentials', async () => {
    const response = await request(app)
      .post('/signin')
      .send({ email: newUser.email, password: newUser.password });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(typeof response.body.token).toBe('string');
    expect(response.body.token.length).toBeGreaterThan(0);

    const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
    expect(decoded._id).toBe(createdUserId);
  });
});

/* ========================================
   POST /signin - ERRO 400
   Dados inválidos (Celebrate/Joi)
======================================== */

describe('POST /signin - invalid data (400)', () => {
  test('should return 400 for invalid email format', async () => {
    const response = await request(app).post('/signin').send({
      email: 'email-invalido',
      password: newUser.password,
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty(
      'message',
      'Dados inválidos fornecidos',
    );
  });

  test('should return 400 for invalid password length', async () => {
    const response = await request(app).post('/signin').send({
      email: newUser.email,
      password: '123',
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty(
      'message',
      'Dados inválidos fornecidos',
    );
  });

  test('should return 400 when email is missing', async () => {
    const response = await request(app).post('/signin').send({
      password: newUser.password,
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty(
      'message',
      'Dados inválidos fornecidos',
    );
  });

  test('should return 400 when password is missing', async () => {
    const response = await request(app).post('/signin').send({
      email: newUser.email,
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty(
      'message',
      'Dados inválidos fornecidos',
    );
  });
});

/* ========================================
   POST /signin - ERRO 401
   Credenciais incorretas
======================================== */

describe('POST /signin - invalid credentials (401)', () => {
  let createdUserId = null;

  // Dados exclusivos desta suíte
  const loginUser = {
    ...newUser,
    email: `signin-${Date.now()}-${process.pid}@example.com`,
  };

  beforeAll(async () => {
    const response = await request(app).post('/signup').send(loginUser);

    expect(response.status).toBe(201);
    createdUserId = response.body._id;
  });

  afterAll(async () => {
    if (createdUserId) {
      await User.deleteOne({ _id: createdUserId });
      createdUserId = null;
    }
  });

  test('should return 401 for unregistered email', async () => {
    const response = await request(app)
      .post('/signin')
      .send({
        email: `unknown-${Date.now()}-${process.pid}@example.com`,
        password: loginUser.password,
      });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty(
      'message',
      'E-mail ou senha incorretos',
    );
  });

  test('should return 401 for incorrect password', async () => {
    const response = await request(app).post('/signin').send({
      email: loginUser.email,
      password: 'SenhaErrada123',
    });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty(
      'message',
      'E-mail ou senha incorretos',
    );
  });
});

/* ========================================
   POST /signin - ERRO 500
   Falha interna simulada
======================================== */

describe('POST /signin - internal server error (500)', () => {
  test('should return 500 for internal server error', async () => {
    // Simula uma falha na busca do usuário.
    // O método real encadeia findOne().select("+password").
    const findOneSpy = jest.spyOn(User, 'findOne').mockReturnValueOnce({
      select: jest
        .fn()
        .mockRejectedValueOnce(new Error('Falha simulada no MongoDB')),
    });

    try {
      const response = await request(app).post('/signin').send({
        email: 'teste500@example.com',
        password: 'SenhaTeste123',
      });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty(
        'message',
        'Ocorreu um erro no servidor',
      );
    } finally {
      // Restaura o método original, mesmo se o teste falhar.
      findOneSpy.mockRestore();
    }
  });
});

describe('Auth middleware - protected routes', () => {
  let createdUserId = null;
  let validToken = null;

  const authUser = {
    ...newUser,
    email: `auth-${Date.now()}-${process.pid}@example.com`,
  };

  beforeAll(async () => {
    // Criar usuário para os testes de autenticação
    const signupResponse = await request(app).post('/signup').send(authUser);

    expect(signupResponse.status).toBe(201);
    createdUserId = signupResponse.body._id;

    // Fazer login e obter um JWT verdadeiro
    const signinResponse = await request(app).post('/signin').send({
      email: authUser.email,
      password: authUser.password,
    });

    expect(signinResponse.status).toBe(200);
    validToken = signinResponse.body.token;
  });

  afterAll(async () => {
    // Remover exclusivamente o usuário criado pela suíte
    if (createdUserId) {
      await User.deleteOne({ _id: createdUserId });
    }
  });

  // =====================================
  // TESTE 200 - ACESSO AUTORIZADO
  // =====================================

  describe('GET /users - authorized access', () => {
    test('should return 200 with a valid JWT', async () => {
      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  // =====================================
  // TESTES 401 - ACESSO NÃO AUTORIZADO
  // =====================================

  describe('GET /users - unauthorized access', () => {
    test('should return 401 when JWT is missing', async () => {
      const response = await request(app).get('/users');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Acesso não autorizado');
    });

    test('should return 401 for an invalid JWT', async () => {
      // Token assinado com uma chave incorreta
      const invalidToken = jwt.sign(
        { _id: createdUserId },
        'chave-incorreta-para-testes',
        { expiresIn: '1h' },
      );

      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Token inválido');
    });

    test('should return 401 for an expired JWT', async () => {
      // Token já expirado há 10 segundos
      const expiredToken = jwt.sign(
        { _id: createdUserId },
        process.env.JWT_SECRET,
        { expiresIn: -10 },
      );

      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Token inválido');
    });

    test('should return 401 without Bearer prefix', async () => {
      const response = await request(app)
        .get('/users')
        .set('Authorization', validToken);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Acesso não autorizado');
    });
  });
});
