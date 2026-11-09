import { apiRequest } from "./apiClient";

function authenticate(userData) {
  return apiRequest("/signin", { method: "POST", body: userData, authenticated: false });
}

function register(userData) {
  return apiRequest("/signup", { method: "POST", body: userData, authenticated: false });
}

function checkToken(token) {
  return apiRequest("/users/me", { token });
}

export { authenticate, register, checkToken };
