const User = require("../models/user");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const jwt = require("jsonwebtoken");

const getUsers = (req, res, next) => {
  User.find({})
    .then((users) => res.send(users))
    .catch((err) => {
      next(err);
    });
};

const getCurrentUser = (req, res, next) => {
  User.findById(req.user._id)
    .orFail()
    .then((user) => res.send(user))
    .catch((err) => {
      next(err);
    });
};

const getUserById = (req, res, next) => {
  User.findById(req.params.userId)
    .orFail()
    .then((user) => res.send(user))
    .catch((err) => {
      next(err);
    });
};

const createUser = async (req, res, next) => {
  const { name, about, avatar, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const newUser = await User.create({
      name,
      about,
      avatar,
      email,
      password: hashedPassword,
    });
    res.status(201).send(newUser.toObject({ useProjection: true }));
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const user = await User.findUserByCredentials(email, password);

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.send({ token });
  } catch (err) {
    next(err);
  }
};

const updateProfileUser = (req, res, next) => {
  const userId = req.user._id;
  const { name, about } = req.body;
  User.findByIdAndUpdate(
    userId,
    { name, about },
    { returnDocument: "after", runValidators: true },
  )
    .orFail()
    .then((updatedUser) => {
      res.send(updatedUser);
    })
    .catch((err) => {
      next(err);
    });
};

const updateAvatarUser = (req, res, next) => {
  const userId = req.user._id;
  const { avatar } = req.body;
  User.findByIdAndUpdate(
    userId,
    { avatar },
    { returnDocument: "after", runValidators: true },
  )
    .orFail()
    .then((updatedUser) => {
      res.send(updatedUser);
    })
    .catch((err) => {
      next(err);
    });
};

module.exports = {
  getUsers,
  getCurrentUser,
  getUserById,
  createUser,
  login,
  updateProfileUser,
  updateAvatarUser,
};
