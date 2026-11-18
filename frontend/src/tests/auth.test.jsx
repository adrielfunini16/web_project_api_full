import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { deferred, fillCredentials, json, login, mockApi, renderApp, userA } from "./helpers";

describe("Login", () => {
  test("não persiste nem autentica quando a verificação do JWT falha", async () => {
    const api = mockApi({ "GET /users/me": () => json({}, 401) });
    const { user } = renderApp();
    await fillCredentials(user);
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByText("Sua sessão expirou ou é inválida. Faça login novamente.");
    expect(localStorage.getItem("jwt")).toBeNull();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    expect(api.calls.map((call) => call.key)).toEqual(["POST /signin", "GET /users/me"]);
  });
  test("autentica, persiste JWT e carrega usuário/cards uma única vez", async () => {
    const api = mockApi();
    const { user } = renderApp();
    await login(user);
    await screen.findByText("Montanha");
    expect(window.location.pathname).toBe("/");
    expect(localStorage.getItem("jwt")).toBe("token-a");
    expect(screen.getByText(userA.email)).toBeInTheDocument();
    expect(api.calls.map((call) => call.key)).toEqual(["POST /signin", "GET /users/me", "GET /cards"]);
    expect(api.calls[0].body).toEqual({ email: userA.email, password: "Password123" });
    expect(api.calls[0].headers.Authorization).toBeUndefined();
    expect(api.calls[1].headers.Authorization).toBe("Bearer token-a");
    expect(api.calls[2].headers.Authorization).toBe("Bearer token-a");
  });

  test.each([["", ""], ["invalido", "Password123"], [userA.email, ""]])("bloqueia formulário inválido %s", async (email, password) => {
    const api = mockApi();
    const { user } = renderApp();
    if (email) await user.type(screen.getByPlaceholderText("E-mail"), email);
    if (password) await user.type(screen.getByPlaceholderText("Senha"), password);
    expect(screen.getByRole("button", { name: "Entrar" })).toBeDisabled();
    expect(api.calls).toHaveLength(0);
  });

  test.each([
    ["credenciais", () => json({}, 401), "E-mail ou senha incorretos."],
    ["rede", () => Promise.reject(new TypeError("offline")), "Não foi possível conectar ao servidor. Confira sua conexão e tente novamente."],
  ])("mostra erro de %s sem buscar dados privados", async (_, handler, message) => {
    const api = mockApi({ "POST /signin": handler });
    const { user } = renderApp();
    await fillCredentials(user);
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(localStorage.getItem("jwt")).toBeNull();
    expect(api.calls.map((call) => call.key)).toEqual(["POST /signin"]);
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  test("bloqueia cliques repetidos enquanto autentica e valida o token", async () => {
    const signin = deferred();
    const profile = deferred();
    const api = mockApi({ "POST /signin": () => signin.promise, "GET /users/me": () => profile.promise });
    const { user } = renderApp();
    await fillCredentials(user);
    await user.dblClick(screen.getByRole("button", { name: "Entrar" }));
    expect(screen.getByRole("button", { name: "Entrando..." })).toBeDisabled();
    expect(api.count("POST /signin")).toBe(1);
    await act(async () => signin.resolve(json({ token: "token-a" })));
    expect(screen.getByRole("button", { name: "Entrando..." })).toBeDisabled();
    await act(async () => profile.resolve(json(userA)));
    await screen.findByText("Montanha");
    expect(api.count("GET /users/me")).toBe(1);
    expect(api.count("GET /cards")).toBe(1);
  });
});

describe("Cadastro", () => {
  test("valida campos e envia credenciais; sucesso mostra tooltip e login", async () => {
    const pending = deferred();
    const api = mockApi({ "POST /signup": () => pending.promise });
    const { user } = renderApp({ path: "/signup" });
    expect(screen.getByRole("button", { name: "Inscrever-se" })).toBeDisabled();
    await user.type(screen.getByPlaceholderText("E-mail"), "invalido");
    await user.type(screen.getByPlaceholderText("Senha"), "Password123");
    expect(screen.getByRole("button", { name: "Inscrever-se" })).toBeDisabled();
    await user.clear(screen.getByPlaceholderText("E-mail"));
    await user.type(screen.getByPlaceholderText("E-mail"), userA.email);
    await user.click(screen.getByRole("button", { name: "Inscrever-se" }));
    expect(api.calls[0].body).toEqual({ email: userA.email, password: "Password123" });
    await act(async () => pending.resolve(json(userA, 201)));
    expect(await screen.findByText("Cadastro realizado com sucesso!")).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe("/signin"));
    expect(localStorage.getItem("jwt")).toBeNull();
    expect(api.calls.map((call) => call.key)).toEqual(["POST /signup"]);
  });

  test.each([
    [409, () => json({}, 409), "Este e-mail já está cadastrado."],
    [400, () => json({}, 400), "Dados inválidos. Confira os campos informados."],
    ["rede", () => Promise.reject(new Error("offline")), "Não foi possível conectar ao servidor. Confira sua conexão e tente novamente."],
  ])("exibe erro %s sem autenticar", async (_, handler, message) => {
    mockApi({ "POST /signup": handler });
    const { user } = renderApp({ path: "/signup" });
    await fillCredentials(user);
    await user.click(screen.getByRole("button", { name: "Inscrever-se" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/signup");
    expect(localStorage.getItem("jwt")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Close modal" }));
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });
});
