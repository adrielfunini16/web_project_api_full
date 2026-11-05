const usersRouter = require("express").Router();

const {
  getUsers,
  getUserById,
  updateProfileUser,
  updateAvatarUser,
} = require("../controllers/users");

usersRouter.get("/", getUsers);
usersRouter.get("/:userId", getUserById);
usersRouter.patch("/me", updateProfileUser);
usersRouter.patch("/me/avatar", updateAvatarUser);

module.exports = usersRouter;
