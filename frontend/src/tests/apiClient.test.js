import { expect, test, vi } from "vitest";
import { apiRequest } from "../utils/apiClient";
import { authenticate, checkToken, register } from "../utils/auth";
import { getToken, removeToken, setToken } from "../utils/token";

test("utilitários persistem e removem o JWT", () => {
  expect(getToken()).toBeNull();
  setToken("session-token");
  expect(getToken()).toBe("session-token");
  removeToken();
  expect(getToken()).toBeNull();
});

test("validação usa token explícito, nunca o token de outra sessão armazenada", async () => {
  setToken("old-token");
  fetch.mockResolvedValue(new Response(JSON.stringify({ _id: "user" })));
  await expect(checkToken("new-token")).resolves.toEqual({ _id: "user" });
  expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/users\/me$/), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer new-token" }) }));
});

test.each([authenticate, register])("rotas públicas não enviam JWT armazenado (%s)", async (operation) => {
  setToken("private-token");
  fetch.mockResolvedValue(new Response(JSON.stringify({})));
  await operation({ email: "ana@example.com", password: "Password123" });
  expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
});

test.each([
  [400, "Dados inválidos. Confira os campos informados."],
  [401, "Sua sessão expirou ou é inválida. Faça login novamente."],
  [403, "Você não tem permissão para realizar esta operação."],
  [404, "O recurso solicitado não foi encontrado."],
  [409, "Este e-mail já está cadastrado."],
  [500, "Ocorreu um erro no servidor. Tente novamente mais tarde."],
])("mantém status %s e mensagem pública", async (status, message) => {
  fetch.mockResolvedValue(new Response(JSON.stringify({ message: "detalhe interno" }), { status }));
  await expect(apiRequest("/cards")).rejects.toMatchObject({ status, message });
});

test("JSON inválido gera feedback controlado sem retry", async () => {
  fetch.mockResolvedValue(new Response("<html>erro</html>"));
  await expect(apiRequest("/cards")).rejects.toThrow("O servidor retornou uma resposta inválida. Tente novamente.");
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("erro de rede gera feedback controlado sem retry", async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError("offline"));
  await expect(apiRequest("/cards")).rejects.toThrow("Não foi possível conectar ao servidor. Confira sua conexão e tente novamente.");
  expect(fetch).toHaveBeenCalledTimes(1);
});
