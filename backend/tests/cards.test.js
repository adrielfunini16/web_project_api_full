require("dotenv").config({ quiet: true });

const { randomUUID } = require("crypto");
const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../app");
const User = require("../models/user");
const Card = require("../models/card");

const MONGO_URI = process.env.MONGO_URI;
const runId = randomUUID();
const emails = [`cards-a-${runId}@example.com`, `cards-b-${runId}@example.com`];
const cardLinks = [];
let databaseAuthorized = false;
let owner;
let otherUser;
let cardId;
let cardLink;

async function registerAndLogin(email) {
  const credentials = { email, password: "CardsTestPassword123" };
  const signupResponse = await request(app)
    .post("/signup")
    .send({
      ...credentials,
      name: "Usuario de teste",
      about: "Teste de exclusao",
      avatar: "https://example.com/avatar.jpg",
    });

  expect(signupResponse.status).toBe(201);
  expect(signupResponse.body).toHaveProperty("_id");

  const signinResponse = await request(app).post("/signin").send(credentials);
  expect(signinResponse.status).toBe(200);
  expect(typeof signinResponse.body.token).toBe("string");
  expect(signinResponse.body.token.length).toBeGreaterThan(0);

  return { id: signupResponse.body._id, token: signinResponse.body.token };
}

beforeAll(async () => {
  // Bloqueia qualquer conexão se o destino não for exatamente o autorizado.
  if (MONGO_URI !== "mongodb://127.0.0.1:27017/around_test") {
    throw new Error("MONGO_URI não corresponde ao banco de testes autorizado");
  }
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET precisa estar configurado para os testes");
  }

  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 3000,
    runtimeAdapters: { os: require("os") },
  });
  databaseAuthorized = true;
  owner = await registerAndLogin(emails[0]);
  otherUser = await registerAndLogin(emails[1]);
});

beforeEach(async () => {
  cardId = null;
  cardLink = `https://example.com/cards-${randomUUID()}.jpg`;
  // Registra a identificação antes da chamada para permitir limpeza após falhas.
  cardLinks.push(cardLink);
  const response = await request(app)
    .post("/cards")
    .set("Authorization", `Bearer ${owner.token}`)
    .send({ name: "Cartao de teste", link: cardLink });

  expect(response.status).toBe(201);
  expect(response.body).toHaveProperty("_id");
  expect(response.body.owner).toBe(owner.id);
  cardId = response.body._id;
});

afterEach(async () => {
  jest.restoreAllMocks();
  if (databaseAuthorized && owner && cardLink) {
    // Estes usuários foram criados exclusivamente por esta execução da suíte.
    await Card.deleteMany({ owner: { $in: [owner.id, otherUser.id] } });
  }
});

describe("GET /cards", () => {
  test("retorna 200 com uma lista contendo os dados do cartão persistido", async () => {
    const response = await request(app)
      .get("/cards")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toContainEqual(
      expect.objectContaining({
        _id: cardId,
        name: "Cartao de teste",
        link: cardLink,
        owner: owner.id,
        likes: [],
        createdAt: expect.any(String),
      }),
    );
  });

  test("retorna uma lista vazia quando a consulta não encontra cartões", async () => {
    // Simula ausência de dados sem excluir cartões de outras suítes ou usuários.
    const spy = jest.spyOn(Card, "find").mockResolvedValueOnce([]);
    try {
      const response = await request(app)
        .get("/cards")
        .set("Authorization", `Bearer ${owner.token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(spy).toHaveBeenCalledWith({});
    } finally {
      spy.mockRestore();
    }
  });

  test.each([
    ["sem token", null, "Acesso não autorizado"],
    ["com token inválido", "jwt-invalido", "Token inválido"],
  ])("retorna 401 %s", async (label, token, message) => {
    const req = request(app).get("/cards");
    if (token) req.set("Authorization", `Bearer ${token}`);
    const response = await req;
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message });
  });

  test("retorna 500 quando a consulta falha", async () => {
    const spy = jest
      .spyOn(Card, "find")
      .mockRejectedValueOnce(new Error("Falha simulada"));
    try {
      const response = await request(app)
        .get("/cards")
        .set("Authorization", `Bearer ${owner.token}`);
      expect(spy).toHaveBeenCalledWith({});
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: "Ocorreu um erro no servidor" });
    } finally {
      spy.mockRestore();
    }
  });
});

describe("POST /cards", () => {
  test("retorna 201 com os dados e persiste o proprietário autenticado", async () => {
    const link = `https://example.com/${randomUUID()}.jpg`;
    cardLinks.push(link);
    const response = await request(app)
      .post("/cards")
      .set("Authorization", `Bearer ${otherUser.token}`)
      .send({ name: "Novo cartao", link });
    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        _id: expect.any(String),
        name: "Novo cartao",
        link,
        owner: otherUser.id,
        likes: [],
        createdAt: expect.any(String),
      }),
    );
    const saved = await Card.findById(response.body._id);
    expect(saved).not.toBeNull();
    expect(saved.name).toBe("Novo cartao");
    expect(saved.link).toBe(link);
    expect(saved.owner.toString()).toBe(otherUser.id);
    expect(saved.likes).toHaveLength(0);
  });

  test.each([
    ["nome ausente", { link: "https://example.com/image.jpg" }],
    ["nome curto", { name: "A", link: "https://example.com/image.jpg" }],
    [
      "nome longo",
      { name: "A".repeat(31), link: "https://example.com/image.jpg" },
    ],
    ["link ausente", { name: "Cartao invalido" }],
    ["URL inválida", { name: "Cartao invalido", link: "nao-e-url" }],
  ])("retorna 400 e não persiste com %s", async (label, payload) => {
    const before = await Card.find({ owner: owner.id }).lean();
    const response = await request(app)
      .post("/cards")
      .set("Authorization", `Bearer ${owner.token}`)
      .send(payload);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Dados inválidos fornecidos" });
    expect(await Card.find({ owner: owner.id }).lean()).toEqual(before);
  });

  test.each([
    ["sem token", null, "Acesso não autorizado"],
    ["com token inválido", "jwt-invalido", "Token inválido"],
  ])("retorna 401 e não cria cartão %s", async (label, token, message) => {
    const link = `https://example.com/${randomUUID()}.jpg`;
    cardLinks.push(link);
    const req = request(app).post("/cards");
    if (token) req.set("Authorization", `Bearer ${token}`);
    const response = await req.send({ name: "Sem permissao", link });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message });
    expect(await Card.exists({ link })).toBeNull();
  });

  test("retorna 500 e não persiste quando a criação falha", async () => {
    const before = await Card.find({ owner: owner.id }).lean();
    const spy = jest
      .spyOn(Card, "create")
      .mockRejectedValueOnce(new Error("Falha simulada"));
    try {
      const response = await request(app)
        .post("/cards")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ name: "Falha de criacao", link: cardLink });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: "Ocorreu um erro no servidor" });
      expect(await Card.find({ owner: owner.id }).lean()).toEqual(before);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("PUT /cards/:cardId/likes", () => {
  test("persiste a curtida de outro usuário e não duplica curtidas repetidas", async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await request(app)
        .put(`/cards/${cardId}/likes`)
        .set("Authorization", `Bearer ${otherUser.token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({
          _id: cardId,
          name: "Cartao de teste",
          link: cardLink,
          owner: owner.id,
          likes: [otherUser.id],
        }),
      );
      const saved = await Card.findById(cardId);
      expect(saved.likes.map(String)).toEqual([otherUser.id]);
    }
  });
});

describe("DELETE /cards/:cardId/likes", () => {
  test("remove somente a própria curtida e persiste o cartão atualizado", async () => {
    for (const user of [owner, otherUser]) {
      const response = await request(app)
        .put(`/cards/${cardId}/likes`)
        .set("Authorization", `Bearer ${user.token}`);
      expect(response.status).toBe(200);
    }
    expect((await Card.findById(cardId)).likes.map(String).sort()).toEqual(
      [owner.id, otherUser.id].sort(),
    );
    const response = await request(app)
      .delete(`/cards/${cardId}/likes`)
      .set("Authorization", `Bearer ${otherUser.token}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        _id: cardId,
        name: "Cartao de teste",
        link: cardLink,
        owner: owner.id,
        likes: [owner.id],
      }),
    );
    expect((await Card.findById(cardId)).likes.map(String)).toEqual([owner.id]);
  });

  test("retorna 200 ao remover uma curtida ausente", async () => {
    const response = await request(app)
      .delete(`/cards/${cardId}/likes`)
      .set("Authorization", `Bearer ${otherUser.token}`);
    expect(response.status).toBe(200);
    expect(response.body._id).toBe(cardId);
    expect(response.body.likes).toEqual([]);
    expect((await Card.findById(cardId)).likes).toHaveLength(0);
  });
});

describe.each(["put", "delete"])(
  "Erros de %s /cards/:cardId/likes",
  (method) => {
    beforeEach(async () => {
      // Uma curtida existente permite detectar alterações indevidas em ambos os métodos.
      const response = await request(app)
        .put(`/cards/${cardId}/likes`)
        .set("Authorization", `Bearer ${owner.token}`);
      expect(response.status).toBe(200);
    });

    test.each([
      ["sem token", null, "Acesso não autorizado"],
      ["com token inválido", "jwt-inva lido", "Token inválido"],
    ])("retorna 401 e preserva o cartão %s", async (label, token, message) => {
      const before = await Card.findById(cardId).lean();
      const req = request(app)[method](`/cards/${cardId}/likes`);
      if (token) req.set("Authorization", `Bearer ${token}`);
      const response = await req;
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message });
      expect(await Card.findById(cardId).lean()).toEqual(before);
    });

    test("retorna 400 para ID inválido sem alterar o cartão", async () => {
      const before = await Card.findById(cardId).lean();
      const response = await request(app)
        [method]("/cards/id-invalido/likes")
        .set("Authorization", `Bearer ${owner.token}`);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: "Dados inválidos fornecidos" });
      expect(await Card.findById(cardId).lean()).toEqual(before);
    });

    test("retorna 404 para cartão inexistente", async () => {
      const id = new mongoose.Types.ObjectId();
      expect(await Card.exists({ _id: id })).toBeNull();
      const response = await request(app)
        [method](`/cards/${id}/likes`)
        .set("Authorization", `Bearer ${owner.token}`);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "ID não encontrado" });
      expect(await Card.exists({ _id: id })).toBeNull();
    });

    test("retorna 500 e preserva o cartão quando a atualização falha", async () => {
      const before = await Card.findById(cardId).lean();
      const spy = jest.spyOn(Card, "findByIdAndUpdate").mockReturnValueOnce({
        orFail: jest.fn().mockRejectedValueOnce(new Error("Falha simulada")),
      });
      try {
        const response = await request(app)
          [method](`/cards/${cardId}/likes`)
          .set("Authorization", `Bearer ${owner.token}`);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          message: "Ocorreu um erro no servidor",
        });
        expect(await Card.findById(cardId).lean()).toEqual(before);
      } finally {
        spy.mockRestore();
      }
    });
  },
);

describe("DELETE /cards/:cardId com JWT inválido", () => {
  test("retorna 401 sem excluir ou alterar o cartão", async () => {
    const before = await Card.findById(cardId).lean();
    const response = await request(app)
      .delete(`/cards/${cardId}`)
      .set("Authorization", "Bearer jwt-invalido");
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Token inválido" });
    expect(await Card.findById(cardId).lean()).toEqual(before);
  });
});

afterAll(async () => {
  jest.restoreAllMocks();
  try {
    if (databaseAuthorized) {
      // Os e-mails e links exclusivos também permitem limpar um setup incompleto.
      const users = await User.find({ email: { $in: emails } }).select("_id");
      await Card.deleteMany({
        owner: { $in: users.map((user) => user._id) },
        link: { $in: cardLinks },
      });
      await User.deleteMany({ email: { $in: emails } });
    }
  } finally {
    await mongoose.disconnect();
  }
});

describe("DELETE /cards/:cardId", () => {
  test("retorna 200 e exclui o cartão quando solicitado pelo proprietário", async () => {
    const response = await request(app)
      .delete(`/cards/${cardId}`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Card deletado com sucesso" });
    expect(await Card.findById(cardId)).toBeNull();
  });

  test("retorna 403 e preserva o cartão quando solicitado por outro usuário", async () => {
    const response = await request(app)
      .delete(`/cards/${cardId}`)
      .set("Authorization", `Bearer ${otherUser.token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      message: "Você não tem permissão para excluir este cartão",
    });
    const savedCard = await Card.findById(cardId);
    expect(savedCard).not.toBeNull();
    expect(savedCard.owner.toString()).toBe(owner.id);
  });

  test("retorna 404 para um ObjectId válido sem cartão correspondente", async () => {
    const nonexistentId = new mongoose.Types.ObjectId();
    expect(await Card.exists({ _id: nonexistentId })).toBeNull();

    const response = await request(app)
      .delete(`/cards/${nonexistentId}`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "ID não encontrado" });
  });

  test("retorna 400 para um ID em formato inválido", async () => {
    const response = await request(app)
      .delete("/cards/id-invalido")
      .set("Authorization", `Bearer ${owner.token}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Dados inválidos fornecidos" });
  });

  test("retorna 401 e preserva o cartão sem cabeçalho Authorization", async () => {
    const response = await request(app).delete(`/cards/${cardId}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Acesso não autorizado" });
    expect(await Card.findById(cardId)).not.toBeNull();
  });

  test("retorna 500 para uma falha inesperada na exclusão", async () => {
    // Preserva a consulta e a autorização reais; simula somente a falha de exclusão.
    const deleteSpy = jest
      .spyOn(Card, "findByIdAndDelete")
      .mockReturnValueOnce({
        orFail: jest
          .fn()
          .mockRejectedValueOnce(new Error("Falha interna simulada")),
      });

    try {
      const response = await request(app)
        .delete(`/cards/${cardId}`)
        .set("Authorization", `Bearer ${owner.token}`);

      expect(deleteSpy).toHaveBeenCalledWith(cardId);
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: "Ocorreu um erro no servidor" });
      expect(await Card.findById(cardId)).not.toBeNull();
    } finally {
      deleteSpy.mockRestore();
    }
  });
});
