import ImagePopup from "../Popup/components/ImagePopup/ImagePopup";

export default function Card(props) {
  const { name, link, isLiked } = props.card;
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
      <button
        aria-label="Delete card"
        className="card__delete-button"
        type="button"
        onClick={() => handleDeleteClick()}
      />
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
