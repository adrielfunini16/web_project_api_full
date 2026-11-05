import logo from "../../images/logo.svg";
import { useState } from "react";

export default function Header({
  children,
  className = "",
  isLoggedIn,
  handleLogout,
  authUser,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleMenuToggle = () => {
    setIsMenuOpen((previousState) => !previousState);
  };

  return (
    <header className={`header page__section ${className}`}>
      <img alt="Around the U.S logo" className="logo header__logo" src={logo} />

      {children}
      {isLoggedIn && (
        <>
          <button
            className={`header__menu-button ${
              isMenuOpen ? "header__menu-button_open" : ""
            }`}
            type="button"
            onClick={handleMenuToggle}
            aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={isMenuOpen}
          >
            <span className="header__menu-line" />
            <span className="header__menu-line" />
            <span className="header__menu-line" />
          </button>
          <div
            className={`header__content ${isMenuOpen ? "header__content_open" : ""}`}
          >
            <p className="header__email">{authUser.email}</p>
            <button className="header__button" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </>
      )}
    </header>
  );
}
