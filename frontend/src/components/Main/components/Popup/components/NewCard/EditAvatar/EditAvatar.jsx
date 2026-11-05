import { useContext, useRef } from "react";
import useFormValidation from "../../../../../../../hooks/useFormValidation";
import CurrentUserContext from "../../../../../../../contexts/CurrentUserContext";

export default function EditAvatar() {
  const { isFormValid, errors, handleInputValidity } = useFormValidation();
  const { handleUpdateAvatar } = useContext(CurrentUserContext);
  const inputRef = useRef();

  const handleSubmit = (e) => {
    e.preventDefault();

    handleUpdateAvatar({ avatar: inputRef.current.value });
  };

  return (
    <form className="popup__form" noValidate onSubmit={handleSubmit}>
      <input
        id="avatar-link-input"
        className="popup__input popup__input_type_url"
        name="avatar"
        placeholder="Link de Imagem"
        required
        type="url"
        ref={inputRef}
        onChange={handleInputValidity}
      />
      <span className="popup__error" id="avatar-link-input-error">
        {errors["avatar"]}
      </span>
      <button
        className="button popup__button"
        type="submit"
        disabled={!isFormValid}
      >
        Salvar
      </button>
    </form>
  );
}
