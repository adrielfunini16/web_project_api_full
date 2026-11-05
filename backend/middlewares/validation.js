const { celebrate, Joi, Segments } = require("celebrate");
const { isValidUrl } = require("../utils/validation");

const validateURL = (value, helpers) => {
  if (isValidUrl(value)) {
    return value;
  }

  return helpers.error("string.uri");
};

const validationSignup = celebrate({
  [Segments.BODY]: Joi.object().keys({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(30).required(),
    name: Joi.string().min(2).max(30).optional(),
    about: Joi.string().min(2).max(30).optional(),
    avatar: Joi.string().custom(validateURL).optional(),
  }),
});

const validationSignin = celebrate({
  [Segments.BODY]: Joi.object().keys({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(30).required(),
  }),
});

module.exports = { validationSignup, validationSignin };
