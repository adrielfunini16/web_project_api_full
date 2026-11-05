const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const validator = require("validator");
const { isValidUrl } = require("../utils/validation");
const UnauthorizedError = require("../errors/UnauthorizedError");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: validator.isEmail,
      message: "Email invalido",
    },
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
  name: {
    type: String,
    minlength: 2,
    maxlength: 30,
    default: "Jacques Cousteau",
  },
  about: {
    type: String,
    minlength: 2,
    maxlength: 30,
    default: "Explorer",
  },
  avatar: {
    type: String,
    validate: {
      validator: isValidUrl,
      message: "URL invalida",
    },
    default:
      "https://practicum-content.s3.us-west-1.amazonaws.com/resources/moved_avatar_1604080799.jpg",
  },
});

userSchema.statics.findUserByCredentials = async function findUserByCredentials(
  email,
  password,
) {
  const user = await this.findOne({ email }).select("+password");

  if (!user) {
    throw new UnauthorizedError();
  }

  const matched = await bcrypt.compare(password, user.password);

  if (!matched) {
    throw new UnauthorizedError();
  }

  return user;
};

module.exports = mongoose.model("user", userSchema);
