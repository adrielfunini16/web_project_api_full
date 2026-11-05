import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "../Header/Header";
import useFormValidation from "../../hooks/useFormValidation";

export default function Register({ handleRegister }) {
  const [data, setData] = useState({ email: "", password: "" });
  const { errors, isFormValid, handleInputValidity } = useFormValidation();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData((prevData) => ({
      ...prevData,
      [name]: value,
    }));

    handleInputValidity(e);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (isFormValid) {
      handleRegister(data);
    }
  };

  return (
    <>
      <div className="auth-page">
        <Header className="auth__header">
          <Link className="auth__button_header" to={"/signin"}>
            Faça o login
          </Link>
        </Header>
        <div className="auth auth__container">
          <h3 className="auth__title">Inscrever-se</h3>
          <form className="auth__form" onSubmit={handleSubmit}>
            <div className="auth__fields">
              <label className="auth__field_label">
                <input
                  className={`auth__input ${errors.email ? "auth__input_type_error" : ""}`}
                  type="email"
                  name="email"
                  value={data.email}
                  onChange={handleChange}
                  required
                  placeholder="E-mail"
                />
                <span className="auth__error" id="login-email-error">
                  {errors["email"]}
                </span>
              </label>
              <label className="auth__field_label">
                <input
                  className={`auth__input ${errors.password ? "auth__input_type_error" : ""}`}
                  type="password"
                  name="password"
                  value={data.password}
                  onChange={handleChange}
                  minLength={8}
                  required
                  placeholder="Senha"
                />
                <span className="auth__error" id="login-password-error">
                  {errors["password"]}
                </span>
              </label>
            </div>
            <button
              className="auth__button"
              type="submit"
              disabled={!isFormValid}
            >
              Inscrever-se
            </button>
          </form>
          <p className="auth__text">
            Já é um membro? Faça o login{" "}
            <Link className="auth__link" to={"/signin"}>
              aqui!
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
