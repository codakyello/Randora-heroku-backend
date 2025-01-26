const express = require("express");
const authController = require("../controllers/authController");
const userController = require("../controllers/userController");

const router = express.Router();

router.post("/login", authController.userLogin);

router.post("/signup", authController.userSignUp);

router.post("/signIn", authController.userSignIn);

router.post("/forgot-password", authController.forgotUserPassword);

router.get(
  "/verify-auth-token",
  authController.authenticate,
  authController.sendVerifiedTokenResponse
);

router.get("/verify-reset-token", authController.verifyResetToken);

router.patch("/reset-password", authController.resetUserPassword);

router.get("/authenticate", authController.authenticateUser);

router.post("/verify-otp", authController.verifyUserOTP);

router.post("/resend-otp", authController.resendUserOTP);

router.get(
  "/search",
  authController.authenticate,
  authController.authorize("user"),
  userController.searchUsers
);

router.patch(
  "/update-my-password",
  authController.authenticate,
  authController.authorize("user"),
  authController.updateMyPassword
);

router
  .route("/me")
  .get(
    authController.authenticate,
    authController.authorize("user"),
    userController.Me
  )
  .patch(
    authController.authenticate,
    authController.authorize("user"),
    userController.updateMe
  )
  .delete(
    authController.authenticate,
    authController.authorize("user"),
    userController.deleteMe
  );

router.get(
  "/me/events",
  authController.authenticate,
  authController.authorize("user"),
  userController.getMyEvents
);

router.get(
  "/",
  authController.authenticate,
  authController.authorize("admin"),
  userController.getAllUser
);

router.get(
  "/search",
  authController.authenticate,
  authController.authorize("user"),
  userController.searchUsers
);
module.exports = router;
