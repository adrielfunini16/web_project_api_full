import { act, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";
import { authenticated, deferred, json, userA } from "./helpers";

test("edita nome e descrição sem refetch nem sobrescrita pela carga de cards", async () => {
  const pending = deferred();
  const updated = { ...userA, name: "Ana Atualizada", about: "Nova descricao" };
  const { user, api } = await authenticated({
    "GET /cards": () => pending.promise,
    "PATCH /users/me": () => json(updated),
  });
  await user.click(screen.getByRole("button", { name: "Editar perfil" }));
  expect(screen.getByPlaceholderText("Nome")).toHaveValue(userA.name);
  await user.clear(screen.getByPlaceholderText("Nome"));
  expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  await user.type(screen.getByPlaceholderText("Nome"), updated.name);
  await user.clear(screen.getByPlaceholderText("Sobre mim"));
  await user.type(screen.getByPlaceholderText("Sobre mim"), updated.about);
  await user.click(screen.getByRole("button", { name: "Salvar" }));
  await screen.findByRole("heading", { name: updated.name });
  expect(screen.getByText(updated.about)).toBeInTheDocument();
  expect(api.calls.find((call) => call.key === "PATCH /users/me").body).toEqual({ name: updated.name, about: updated.about });
  await act(async () => pending.resolve(json([])));
  expect(screen.getByRole("heading", { name: updated.name })).toBeInTheDocument();
  expect(api.count("GET /users/me")).toBe(1);
});

test("valida URL do avatar e aplica resposta do PATCH", async () => {
  const avatar = "https://example.com/new-avatar.jpg";
  const { user, api } = await authenticated({ "PATCH /users/me/avatar": () => json({ ...userA, avatar }) });
  await user.click(screen.getByRole("button", { name: "Editar foto do perfil" }));
  const input = screen.getByPlaceholderText("Link de Imagem");
  expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  await user.type(input, "nao-url");
  expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  await user.clear(input);
  await user.type(input, avatar);
  await user.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(screen.getByRole("img", { name: "Avatar" })).toHaveAttribute("src", avatar));
  expect(api.calls.find((call) => call.key === "PATCH /users/me/avatar").body).toEqual({ avatar });
});

test.each([400, 500, 401])("erro %s ao editar preserva perfil ou encerra sessão", async (status) => {
  const { user } = await authenticated({ "PATCH /users/me": () => json({}, status) });
  await user.click(screen.getByRole("button", { name: "Editar perfil" }));
  await user.clear(screen.getByPlaceholderText("Nome"));
  await user.type(screen.getByPlaceholderText("Nome"), "Nao salvo");
  await user.click(screen.getByRole("button", { name: "Salvar" }));
  const messages = {
    400: "Dados inválidos. Confira os campos informados.",
    401: "Sua sessão expirou ou é inválida. Faça login novamente.",
    500: "Ocorreu um erro no servidor. Tente novamente mais tarde.",
  };
  await screen.findByText(messages[status]);
  if (status === 401) {
    await screen.findByRole("button", { name: "Entrar" });
    expect(localStorage.getItem("jwt")).toBeNull();
    expect(screen.queryByText(userA.name)).not.toBeInTheDocument();
  } else {
    expect(screen.getByRole("heading", { name: userA.name })).toBeInTheDocument();
    expect(localStorage.getItem("jwt")).toBe("token-a");
  }
});
