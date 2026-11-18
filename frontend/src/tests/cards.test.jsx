import { act, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { authenticated, card, deferred, json, userB } from "./helpers";

test("carga inicial bloqueia criação, ordena por data e não repete GET", async () => {
  const pending = deferred();
  const { api } = await authenticated({ "GET /cards": () => pending.promise });
  expect(screen.getByRole("button", { name: "Adicionar cartão" })).toBeDisabled();
  await act(async () => pending.resolve(json([
    card,
    { ...card, _id: "card-b", name: "Mais recente", createdAt: "2026-02-01T00:00:00.000Z" },
  ])));
  expect(screen.getAllByRole("listitem").map((item) => within(item).getByRole("heading").textContent)).toEqual(["Mais recente", card.name]);
  expect(screen.getByRole("button", { name: "Adicionar cartão" })).toBeEnabled();
  expect(api.count("GET /cards")).toBe(1);
});

test("coleção vazia libera criação sem renderizar cards", async () => {
  await authenticated({ "GET /cards": () => json([]) });
  await waitFor(() => expect(screen.getByRole("button", { name: "Adicionar cartão" })).toBeEnabled());
  expect(screen.queryAllByRole("listitem")).toHaveLength(0);
});

test("falha na galeria informa erro e termina loading mantendo perfil", async () => {
  await authenticated({ "GET /cards": () => json({}, 500) });
  expect(await screen.findByText("Ocorreu um erro no servidor. Tente novamente mais tarde.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Adicionar cartão" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
});

test("valida criação, envia payload e adiciona card sem novo GET", async () => {
  const added = { ...card, _id: "new", name: "Praia", link: "https://example.com/praia.jpg" };
  const { user, api } = await authenticated({ "POST /cards": () => json(added, 201) });
  await screen.findByText(card.name);
  await user.click(screen.getByRole("button", { name: "Adicionar cartão" }));
  expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  await user.type(screen.getByPlaceholderText("Title"), added.name);
  await user.type(screen.getByPlaceholderText("Image link"), "invalido");
  expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  await user.clear(screen.getByPlaceholderText("Image link"));
  await user.type(screen.getByPlaceholderText("Image link"), added.link);
  await user.click(screen.getByRole("button", { name: "Salvar" }));
  await screen.findByText(added.name);
  expect(within(screen.getAllByRole("listitem")[0]).getByRole("heading")).toHaveTextContent(added.name);
  expect(api.calls.find((call) => call.key === "POST /cards").body).toEqual({ name: added.name, link: added.link });
  expect(api.count("GET /cards")).toBe(1);
});

test("exclui somente card próprio e atualiza a galeria", async () => {
  const { user, api } = await authenticated({
    "GET /cards": () => json([card, { ...card, _id: "other", name: "De outra pessoa", owner: userB._id }]),
    "DELETE /cards/card-a": () => json({ message: "Card deletado com sucesso" }),
  });
  await screen.findByText(card.name);
  expect(screen.getAllByRole("button", { name: "Delete card" })).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Delete card" }));
  await waitFor(() => expect(screen.queryByText(card.name)).not.toBeInTheDocument());
  expect(screen.getByText("De outra pessoa")).toBeInTheDocument();
  expect(api.count("DELETE /cards/card-a")).toBe(1);
});

test("curte e descurte usando resposta do servidor", async () => {
  const { user, api } = await authenticated({
    "PUT /cards/card-a/likes": () => json({ ...card, likes: [card.owner] }),
    "DELETE /cards/card-a/likes": () => json(card),
  });
  const button = await screen.findByRole("button", { name: "Like card" });
  expect(button).not.toHaveClass("card__like-button_is-active");
  await user.click(button);
  await waitFor(() => expect(button).toHaveClass("card__like-button_is-active"));
  await user.click(button);
  await waitFor(() => expect(button).not.toHaveClass("card__like-button_is-active"));
  expect(api.count("PUT /cards/card-a/likes")).toBe(1);
  expect(api.count("DELETE /cards/card-a/likes")).toBe(1);
});

test.each([403, 404, 500])("erro %s na exclusão preserva card e sessão", async (status) => {
  const { user } = await authenticated({ "DELETE /cards/card-a": () => json({}, status) });
  await user.click(await screen.findByRole("button", { name: "Delete card" }));
  await screen.findByRole("button", { name: "Close modal" });
  expect(screen.getByText(card.name)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
});

test("401 nas curtidas remove sessão e cards", async () => {
  const { user } = await authenticated({ "PUT /cards/card-a/likes": () => json({}, 401) });
  await user.click(await screen.findByRole("button", { name: "Like card" }));
  await screen.findByRole("button", { name: "Entrar" });
  expect(screen.queryByText(card.name)).not.toBeInTheDocument();
  expect(localStorage.getItem("jwt")).toBeNull();
});

test("erro de criação mantém formulário e não insere card inexistente", async () => {
  const { user } = await authenticated({ "POST /cards": () => json({}, 400) });
  await screen.findByText(card.name);
  await user.click(screen.getByRole("button", { name: "Adicionar cartão" }));
  await user.type(screen.getByPlaceholderText("Title"), "Nao criado");
  await user.type(screen.getByPlaceholderText("Image link"), "https://example.com/new.jpg");
  await user.click(screen.getByRole("button", { name: "Salvar" }));
  await screen.findByText("Dados inválidos. Confira os campos informados.");
  expect(screen.getByPlaceholderText("Title")).toHaveValue("Nao criado");
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
});

test("erro de rede na curtida mantém estado anterior", async () => {
  const { user } = await authenticated({ "PUT /cards/card-a/likes": () => Promise.reject(new Error("offline")) });
  const button = await screen.findByRole("button", { name: "Like card" });
  await user.click(button);
  await screen.findByText(/Não foi possível conectar ao servidor/);
  expect(button).not.toHaveClass("card__like-button_is-active");
  expect(localStorage.getItem("jwt")).toBe("token-a");
});
