const BASE_URL = "https://se-register-api.en.tripleten-services.com/v1";

function authenticate(userData) {
  return fetch(`${BASE_URL}/signin`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  }).then((res) => {
    if (res.ok) {
      return res.json();
    }

    const messages = {
      400: "Preencha todos os campos obrigatórios.",
      401: "E-mail ou senha incorretos.",
    };

    const error = new Error(messages[res.status] ?? "Falha na autenticação.");

    error.status = res.status;
    return Promise.reject(error);
  });
}

function register(userData) {
  return fetch(`${BASE_URL}/signup`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  }).then((res) => {
    if (res.ok) {
      return res.json();
    }

    const messages = {
      400: "Dados inválidos ou e-mail já cadastrado.",
    };

    const error = new Error(messages[res.status] ?? "Falha ao criar conta.");

    error.status = res.status;
    return Promise.reject(error);
  });
}

function checkToken(token) {
  return fetch(`${BASE_URL}/users/me`, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  }).then((res) => {
    if (res.ok) {
      return res.json();
    }

    const messages = {
      400: "Token ausente ou em formato incorreto.",
      401: "Token inválido. Faça login novamente.",
    };

    const error = new Error(
      messages[res.status] ?? "Falha ao verificar a sessão.",
    );

    error.status = res.status;
    error.source = "checkToken";

    return Promise.reject(error);
  });
}

export { authenticate, register, checkToken };
