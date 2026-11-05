import { useState } from "react";

export default function useFormValidation() {
  const [errors, setErrors] = useState({});
  const [isFormValid, setIsFormValid] = useState(false);

  const handleInputValidity = (e) => {
    const { name, validity, validationMessage, form } = e.target;
    setErrors((prevErrors) => ({
      ...prevErrors,
      [name]: validity.valid ? "" : validationMessage,
    }));

    setIsFormValid(form.checkValidity());
  };

  const validateForm = (form) => {
    setIsFormValid(form.checkValidity());
  };

  return {
    errors,
    handleInputValidity,
    isFormValid,
    validateForm,
  };
}
