import { StrictMode } from "react";
import { BrowserRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, vi } from "vitest";
import App from "../components/App";

export const userA = { _id: "user-a", email: "ana@example.com", name: "Ana Silva", about: "Exploradora", avatar: "https://example.com/ana.jpg" };
export const userB = { ...userA, _id: "user-b", email: "bia@example.com", name: "Bia Souza" };
export const card = { _id: "card-a", name: "Montanha", link: "https://example.com/card.jpg", owner: userA._id, likes: [], createdAt: "2026-01-01T00:00:00.000Z" };
export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

let unexpected = [];
afterEach(() => {
  expect(unexpected).toEqual([]);
  unexpected = [];
});

export function mockApi(overrides = {}) {
  const handlers = {
    "POST /signin": () => json({ token: "token-a" }),
    "GET /users/me": () => json(userA),
    "GET /cards": () => json([card]),
    ...overrides,
  };
  const calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
    const key = `${options.method || "GET"} ${new URL(url).pathname}`;
    calls.push({ key, ...options, body: options.body ? JSON.parse(options.body) : undefined });
    if (!handlers[key]) {
      unexpected.push(key);
      throw new Error(`Requisição inesperada: ${key}`);
    }
    return handlers[key](calls.at(-1));
  }));
  return { calls, handlers, count: (key) => calls.filter((call) => call.key === key).length };
}

// BrowserRouter real reproduz mudanças na identidade de navigate.
// As contagens de produção são testadas sem o replay de efeitos de StrictMode.
export function renderApp({ path = "/signin", token, strict = false } = {}) {
  if (token) localStorage.setItem("jwt", token);
  window.history.replaceState({}, "", path);
  const app = <BrowserRouter><App /></BrowserRouter>;
  return { ...render(strict ? <StrictMode>{app}</StrictMode> : app), user: userEvent.setup() };
}

export async function fillCredentials(user, email = userA.email, password = "Password123") {
  // Prepara credenciais sem agendar um timer por caractere; os testes de digitação usam type.
  await user.click(screen.getByPlaceholderText("E-mail"));
  await user.paste(email);
  await user.click(screen.getByPlaceholderText("Senha"));
  await user.paste(password);
}

export async function login(user, email = userA.email) {
  await fillCredentials(user, email);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  await screen.findByRole("button", { name: "Sair" });
}

export async function authenticated(overrides = {}) {
  const api = mockApi(overrides);
  const view = renderApp({ path: "/", token: "token-a" });
  await screen.findByRole("heading", { name: userA.name });
  return { ...view, api };
}
