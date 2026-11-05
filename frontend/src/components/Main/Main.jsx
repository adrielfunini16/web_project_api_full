import { useContext } from "react";
import Popup from "./components/Popup/Popup";
import EditAvatar from "./components/Popup/components/NewCard/EditAvatar/EditAvatar";
import EditProfile from "./components/Popup/components/NewCard/EditProfile/EditProfile";
import NewCard from "./components/Popup/components/NewCard/NewCard";
import Card from "./components/Card/Card";
import CurrentUserContext from "../../contexts/CurrentUserContext";

export default function Main(props) {
  const { onOpenPopup, onClosePopup, popup, cards, onCardLike, onCardDelete } =
    props;
  const { currentUser } = useContext(CurrentUserContext);

  const newCardPopup = { title: "New card", children: <NewCard /> };
  const editProfilePopup = { title: "Edit Profile", children: <EditProfile /> };
  const editAvatarPopup = { title: "Edit Avatar", children: <EditAvatar /> };

  return (
    <main className="content">
      <section className="profile page__section">
        <div className="profile__avatar-container">
          <img
            className="profile__image"
            src={currentUser.avatar}
            alt="Avatar"
          />
          <button
            aria-label="Editar foto do perfil"
            className="profile__avatar-edit-button"
            type="button"
            onClick={() => onOpenPopup(editAvatarPopup)}
          ></button>
        </div>
        <div className="profile__info">
          <h1 className="profile__title">{currentUser.name}</h1>
          <button
            aria-label="Editar perfil"
            className="profile__edit-button"
            type="button"
            onClick={() => onOpenPopup(editProfilePopup)}
          ></button>
          <p className="profile__description">{currentUser.about}</p>
        </div>
        <button
          aria-label="Adicionar cartão"
          className="profile__add-button"
          type="button"
          onClick={() => onOpenPopup(newCardPopup)}
        ></button>
      </section>
      <section className="cards page__section">
        <ul className="cards__list">
          {cards.map((card) => (
            <Card
              key={card._id}
              card={card}
              onOpenPopup={onOpenPopup}
              onCardLike={onCardLike}
              onCardDelete={onCardDelete}
            />
          ))}
        </ul>
      </section>
      {popup && (
        <Popup onClose={onClosePopup} title={popup.title}>
          {popup.children}
        </Popup>
      )}
    </main>
  );
}
