import ImagePopup from "../Popup/components/ImagePopup/ImagePopup";
import { useContext } from "react";
import CurrentUserContext from "../../../../contexts/CurrentUserContext";

export default function Card(props) {
  const { name, link, likes, owner } = props.card;
  const { currentUser } = useContext(CurrentUserContext);
  const isLiked = likes.includes(currentUser._id);
  const isOwner = owner === currentUser._id;
  const { onOpenPopup, onCardLike, onCardDelete } = props;

  const imageComponent = { children: <ImagePopup card={props.card} /> };
  const cardLikeButtonClassName = `card__like-button ${
    isLiked ? "card__like-button_is-active" : ""
  }`;

  function handleLikeClick() {
    onCardLike(props.card);
  }

  function handleDeleteClick() {
    onCardDelete(props.card);
  }

  return (
    <li className="card">
      <img
        className="card__image"
        src={link}
        alt={name}
        onClick={() => onOpenPopup(imageComponent)}
      />
      {isOwner && <button
        aria-label="Delete card"
        className="card__delete-button"
        type="button"
        onClick={() => handleDeleteClick()}
      />}
      <div className="card__description">
        <h2 className="card__title">{name}</h2>
        <button
          aria-label="Like card"
          type="button"
          className={cardLikeButtonClassName}
          onClick={() => handleLikeClick()}
        />
      </div>
    </li>
  );
}
