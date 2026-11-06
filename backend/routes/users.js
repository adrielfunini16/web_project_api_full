const usersRouter = require("express").Router();

const {
  getUsers,
  getCurrentUser,
  getUserById,
  updateProfileUser,
  updateAvatarUser,
} = require("../controllers/users");

const {
  validationUserId,
  validationUpdateProfile,
  validationUpdateAvatar,
} = require("../middlewares/validation");

usersRouter.get("/", getUsers);

usersRouter.get("/me", getCurrentUser);

usersRouter.get("/:userId", validationUserId, getUserById);

usersRouter.patch("/me", validationUpdateProfile, updateProfileUser);

usersRouter.patch("/me/avatar", validationUpdateAvatar, updateAvatarUser);

module.exports = usersRouter;
