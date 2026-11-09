import { getToken } from "./token";

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:3000" : "https://api.around.clux.com")
).replace(/\/+$/, "");

const messages = {
  400: "Dados inválidos. Confira os campos informados.",
  401: "Sua sessão expirou ou é inválida. Faça login novamente.",
  403: "Você não tem permissão para realizar esta operação.",
  404: "O recurso solicitado não foi encontrado.",
  409: "Este e-mail já está cadastrado.",
  500: "Ocorreu um erro no servidor. Tente novamente mais tarde.",
};

export async function apiRequest(path, { method = "GET", body, authenticated = true, token = getToken() } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error("Não foi possível conectar ao servidor. Confira sua conexão e tente novamente.");
  }

  if (!response.ok) {
    const message = response.status === 401 && path === "/signin"
      ? "E-mail ou senha incorretos."
      : messages[response.status] || "Não foi possível concluir a operação.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  try {
    return await response.json();
  } catch {
    throw new Error("O servidor retornou uma resposta inválida. Tente novamente.");
  }
}
