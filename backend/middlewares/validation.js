const { celebrate, Joi, Segments } = require('celebrate');
const { isValidUrl } = require('../utils/validation');

const nameSchema = Joi.string().min(2).max(30);
const objectIdSchema = Joi.string().hex().length(24);

const isValidUrlSchema = Joi.string().custom((value, helpers) => {
  if (!isValidUrl(value)) {
    return helpers.error('string.uri');
  }

  return value;
});

// Public routes

const validationSignup = celebrate({
  [Segments.BODY]: Joi.object().keys({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(30).required(),
    name: nameSchema.optional(),
    about: nameSchema.optional(),
    avatar: isValidUrlSchema.optional(),
  }),
});

const validationSignin = celebrate({
  [Segments.BODY]: Joi.object().keys({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(30).required(),
  }),
});

// User routes

const validationUserId = celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    userId: objectIdSchema.required(),
  }),
});

const validationUpdateProfile = celebrate({
  [Segments.BODY]: Joi.object().keys({
    name: nameSchema.required(),
    about: nameSchema.required(),
  }),
});

const validationUpdateAvatar = celebrate({
  [Segments.BODY]: Joi.object().keys({
    avatar: isValidUrlSchema.required(),
  }),
});

// Card routes

const validationCreateCard = celebrate({
  [Segments.BODY]: Joi.object().keys({
    name: nameSchema.required(),
    link: isValidUrlSchema.required(),
  }),
});

const validationCardId = celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    cardId: objectIdSchema.required(),
  }),
});

module.exports = {
  validationSignup,
  validationSignin,
  validationUserId,
  validationUpdateProfile,
  validationUpdateAvatar,
  validationCreateCard,
  validationCardId,
};
