import successIcon from "../../images/success-icon.svg";
import errorIcon from "../../images/error-icon.svg";

export default function InfoTooltip({ isSuccess, onClose }) {
  return (
    <div className="popup">
      <div className="popup__content">
        <button
          aria-label="Close modal"
          className="popup__close"
          type="button"
          onClick={onClose}
        ></button>
        <div className="info-tooltip__content">
          <img
            className="info-tooltip__icon"
            alt="logo info-tooltip"
            src={isSuccess ? successIcon : errorIcon}
          />
          <h3 className="info-tooltip__title">
            {isSuccess
              ? "Cadastro realizado com sucesso!"
              : "Ops, algo deu errado! Por favor, tente novamente."}
          </h3>
        </div>
      </div>
    </div>
  );
}
