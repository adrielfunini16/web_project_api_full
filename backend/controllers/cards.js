const Card = require('../models/card');

const getCards = (req, res, next) => {
  Card.find({})
    .then((cards) => res.send(cards))
    .catch((err) => next(err));
};

const createCard = (req, res, next) => {
  const { name, link } = req.body;
  const owner = req.user._id;
  Card.create({ name, link, owner })
    .then((newCard) => res.status(201).send(newCard))
    .catch((err) => {
      next(err);
    });
};

const deleteCard = (req, res, next) => {
  const { cardId } = req.params;
  Card.findByIdAndDelete(cardId)
    .orFail()
    .then(() => {
      res.send({ message: 'Card deletado com sucesso' });
    })
    .catch((err) => {
      next(err);
    });
};

const likeCard = (req, res, next) => {
  const userId = req.user._id;
  const { cardId } = req.params;
  Card.findByIdAndUpdate(
    cardId,
    { $addToSet: { likes: userId } },
    { returnDocument: 'after' },
  )
    .orFail()
    .then((card) => res.send(card))
    .catch((err) => {
      next(err);
    });
};

const dislikeCard = (req, res, next) => {
  const userId = req.user._id;
  const { cardId } = req.params;
  Card.findByIdAndUpdate(
    cardId,
    { $pull: { likes: userId } },
    { returnDocument: 'after' },
  )
    .orFail()
    .then((card) => res.send(card))
    .catch((err) => {
      next(err);
    });
};

module.exports = {
  getCards,
  createCard,
  deleteCard,
  likeCard,
  dislikeCard,
};
