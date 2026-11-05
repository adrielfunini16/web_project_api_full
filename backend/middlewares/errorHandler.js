const mongoose = require("mongoose");
const { isCelebrateError } = require("celebrate");

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (isCelebrateError(err)) {
    return res.status(400).json({ message: "Dados inválidos fornecidos" });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ message: "Dados inválidos fornecidos" });
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: "ID inválido fornecido" });
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Dados inválidos fornecidos" });
  }

  if (err instanceof mongoose.Error.DocumentNotFoundError) {
    return res.status(404).json({ message: "ID não encontrado" });
  }

  if (err.status === 401) {
    return res.status(401).json({
      message: err.message,
    });
  }

  if (err.name === "MongoServerError" && err.code === 11000) {
    return res.status(409).json({ message: "Conflito de dados" });
  }

  return res.status(500).json({ message: "Ocorreu um erro no servidor" });
};

module.exports = errorHandler;
