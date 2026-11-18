import { act, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";
import { authenticated, card, deferred, json, login, mockApi, renderApp, userA, userB } from "./helpers";

test.each(["/", "/desconhecida"])("sem token redireciona %s sem HTTP", async (path) => {
  const api = mockApi();
  renderApp({ path });
  await screen.findByRole("button", { name: "Entrar" });
  expect(window.location.pathname).toBe("/signin");
  expect(api.calls).toHaveLength(0);
});

test.each(["/", "/signin", "/signup", "/desconhecida"])("restaura sessão em %s sem buscas duplicadas", async (path) => {
  const profile = deferred();
  const api = mockApi({ "GET /users/me": () => profile.promise });
  renderApp({ path, token: "token-a" });
  expect(screen.getByRole("status")).toHaveTextContent("Verificando sua sessão...");
  expect(screen.queryByRole("button", { name: "Entrar" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
  expect(api.calls.map((call) => call.key)).toEqual(["GET /users/me"]);
  await act(async () => profile.resolve(json(userA)));
  await screen.findByText(card.name);
  await waitFor(() => expect(window.location.pathname).toBe("/"));
  expect(api.calls.map((call) => call.key)).toEqual(["GET /users/me", "GET /cards"]);
});

test.each([401, 404])("restauração inválida (%s) limpa sessão sem carregar cards", async (status) => {
  const api = mockApi({ "GET /users/me": () => json({}, status) });
  renderApp({ path: "/", token: "expired-token" });
  await screen.findByRole("button", { name: "Entrar" });
  expect(localStorage.getItem("jwt")).toBeNull();
  expect(api.calls.map((call) => call.key)).toEqual(["GET /users/me"]);
  expect(screen.getByRole("button", { name: "Close modal" })).toBeInTheDocument();
});

test("falha de rede na restauração termina loading e preserva token", async () => {
  mockApi({ "GET /users/me": () => Promise.reject(new Error("offline")) });
  renderApp({ token: "token-a", path: "/" });
  await screen.findByRole("button", { name: "Entrar" });
  expect(await screen.findByText(/Não foi possível conectar ao servidor/)).toBeInTheDocument();
  expect(localStorage.getItem("jwt")).toBe("token-a");
});

test("logout não faz GETs e o login seguinte troca identidade e propriedade", async () => {
  const { api, user } = await authenticated();
  await screen.findByText(card.name);
  expect(screen.getByRole("button", { name: "Delete card" })).toBeInTheDocument();
  const count = api.calls.length;
  await user.click(screen.getByRole("button", { name: "Sair" }));
  await screen.findByRole("button", { name: "Entrar" });
  expect(localStorage.getItem("jwt")).toBeNull();
  expect(screen.queryByText(userA.name)).not.toBeInTheDocument();
  expect(api.calls).toHaveLength(count);
  api.handlers["POST /signin"] = () => json({ token: "token-b" });
  api.handlers["GET /users/me"] = () => json(userB);
  await login(user, userB.email);
  await screen.findByText(card.name);
  expect(screen.getByRole("heading", { name: userB.name })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Delete card" })).not.toBeInTheDocument();
  expect(api.calls.slice(count).map((call) => call.key)).toEqual(["POST /signin", "GET /users/me", "GET /cards"]);
});

test.each(["success", "401"])("resposta de perfil antiga (%s) não afeta novo login com o mesmo JWT", async (outcome) => {
  const pending = deferred();
  const { user, api } = await authenticated({ "PATCH /users/me": () => pending.promise });
  await user.click(screen.getByRole("button", { name: "Editar perfil" }));
  const input = screen.getByPlaceholderText("Nome");
  await user.clear(input);
  await user.type(input, "Perfil antigo");
  await user.click(screen.getByRole("button", { name: "Salvar" }));
  expect(api.count("PATCH /users/me")).toBe(1);
  await user.click(screen.getByRole("button", { name: "Sair" }));
  await screen.findByRole("button", { name: "Entrar" });
  await login(user);
  await act(async () => pending.resolve(outcome === "401" ? json({}, 401) : json({ ...userA, name: "Perfil antigo" })));
  expect(screen.getByRole("heading", { name: userA.name })).toBeInTheDocument();
  expect(localStorage.getItem("jwt")).toBe("token-a");
  expect(screen.queryByText("Perfil antigo")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Close modal" })).not.toBeInTheDocument();
});

test("cards antigos após logout e novo login não substituem a sessão atual", async () => {
  const pending = deferred();
  const { api, user } = await authenticated({ "GET /cards": () => pending.promise });
  await user.click(screen.getByRole("button", { name: "Sair" }));
  await screen.findByRole("button", { name: "Entrar" });
  api.handlers["GET /cards"] = () => json([{ ...card, name: "Atual" }]);
  await login(user);
  await screen.findByText("Atual");
  await act(async () => pending.resolve(json([{ ...card, name: "Obsoleto" }])));
  expect(screen.queryByText("Obsoleto")).not.toBeInTheDocument();
  expect(screen.getByText("Atual")).toBeInTheDocument();
});

test("StrictMode descarta restauração obsoleta sem aplicar erro nem duplicar cards", async () => {
  const old = deferred();
  let checks = 0;
  const api = mockApi({ "GET /users/me": () => ++checks === 1 ? old.promise : json(userA) });
  renderApp({ token: "token-a", path: "/", strict: true });
  await screen.findByText(card.name);
  await act(async () => old.resolve(json({}, 401)));
  expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  expect(localStorage.getItem("jwt")).toBe("token-a");
  expect(api.count("GET /users/me")).toBe(2); // Replay de desenvolvimento, explicitamente separado.
  expect(api.count("GET /cards")).toBe(1);
});
