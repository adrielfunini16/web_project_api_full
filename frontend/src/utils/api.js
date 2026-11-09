import { apiRequest } from "./apiClient";

class Api {
  getInitialCards() {
    return apiRequest("/cards");
  }

  getUserInfo() {
    return apiRequest("/users/me");
  }

  getAppInfo() {
    return Promise.all([this.getUserInfo(), this.getInitialCards()]);
  }

  editProfileData({ name, about }) {
    return apiRequest("/users/me", { method: "PATCH", body: { name, about } });
  }

  addNewCard({ name, link }) {
    return apiRequest("/cards", { method: "POST", body: { name, link } });
  }

  cardDelete(cardId) {
    return apiRequest(`/cards/${cardId}`, { method: "DELETE" });
  }

  cardLike(cardId) {
    return apiRequest(`/cards/${cardId}/likes`, { method: "PUT" });
  }

  removeCardLike(cardId) {
    return apiRequest(`/cards/${cardId}/likes`, { method: "DELETE" });
  }

  updateAvatar({ avatar }) {
    return apiRequest("/users/me/avatar", { method: "PATCH", body: { avatar } });
  }

  changeLikeCardStatus(cardId, shouldLike) {
    return shouldLike ? this.cardLike(cardId) : this.removeCardLike(cardId);
  }
}

export default new Api();
