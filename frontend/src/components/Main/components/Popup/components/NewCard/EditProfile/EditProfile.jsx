import { useState, useContext, useRef, useEffect } from "react";
import useFormValidation from "../../../../../../../hooks/useFormValidation";
import CurrentUserContext from "../../../../../../../contexts/CurrentUserContext";

export default function EditProfile() {
  const formRef = useRef();
  const { validateForm, isFormValid, errors, handleInputValidity } =
    useFormValidation();
  const { currentUser, handleUpdateUser } = useContext(CurrentUserContext);
  const [name, setName] = useState(currentUser.name);
  const [description, setDescription] = useState(currentUser.about);

  useEffect(() => {
    if (formRef.current) {
      validateForm(formRef.current);
    }
  }, [name, description]);

  const handleNameChange = (event) => {
    setName(event.target.value);
    handleInputValidity(event);
  };

  const handleDescriptionChange = (event) => {
    setDescription(event.target.value);
    handleInputValidity(event);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    handleUpdateUser({ name, about: description });
  };

  return (
    <form
      className="popup__form"
      name="profile-form"
      id="edit-profile-form"
      onSubmit={handleSubmit}
      ref={formRef}
      noValidate
    >
      <label className="popup__label">
        <input
          className="popup__input popup__input_type_name"
          id="owner-name"
          maxLength="40"
          minLength="2"
          name="userName"
          placeholder="Nome"
          required
          type="text"
          value={name}
          onChange={handleNameChange}
        />
        <span className="popup__error" id="owner-name-error">
          {errors["userName"]}
        </span>
      </label>
      <label className="popup__label">
        <input
          className="popup__input popup__input_type_description"
          id="owner-description"
          maxLength="200"
          minLength="2"
          name="userDescription"
          placeholder="Sobre mim"
          required
          type="text"
          value={description}
          onChange={handleDescriptionChange}
        />
        <span className="popup__error" id="owner-description-error">
          {errors["userDescription"]}
        </span>
      </label>
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
