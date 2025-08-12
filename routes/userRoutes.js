const express = require("express");
const userRouter = express.Router();
const {
  registerUser,
  loginUser,
  activateUser,
  resendActivationCode,
  updateAccessToken,
  logoutUser,
  getUserInfo,
  updateUserInfo,
  updateUserPassword,
} = require("../controllers/userControllers");
const { isAuthenticated } = require("../middlewares/Auth");

// test user Route
userRouter.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "User routes are working"
    });
});
// register user
userRouter.post("/register", registerUser);

// activate user
userRouter.post("/activate-user", activateUser);

// resed activation code
userRouter.post("/resend-activation-code", resendActivationCode);

// login user
userRouter.post("/login", loginUser);


// // logout user
userRouter.get("/logout", isAuthenticated, logoutUser)

// // get access token from refresh token
userRouter.get("/refresh-token", updateAccessToken);

// // get user info
userRouter.get("/me", isAuthenticated, getUserInfo)

// // social auth
// userRouter.post("/social-auth", socialAuth);

// // update user info
userRouter.put("/update-user-info", isAuthenticated, updateUserInfo);

// // update user password
userRouter.put("/update-user-password", isAuthenticated, updateUserPassword);

// // update user profile picture
// userRouter.put("/update-user-profile-picture", isAuthenticated, updateProfilePicture);

module.exports = userRouter;