const express = require("express");
const {
  signup,
  verifyAccount,
  resendOTP,
  login,
  logout,
  forgetPassword,
  resetPassword,
  changePassword,
} = require("../controllers/authController");
const isAuthenticated = require("../middlewares/isAuthenticated");
const upload = require("../middlewares/multer");
const { updateProfile, getMe } = require("../controllers/userController");

const router = express.Router();

router.post("/signup", signup);
router.post("/verify", isAuthenticated, verifyAccount);
router.post("/resend-otp", isAuthenticated, resendOTP);
router.post("/login", login);
router.post("/logout", logout);
router.post("/forget-password", forgetPassword);
router.post("/reset-password", resetPassword);
router.post("/change-password", isAuthenticated, changePassword);

router.get("/me", isAuthenticated, getMe);

router.patch(
  "/update-profile",
  isAuthenticated,
  upload.single("profilePhoto"),
  updateProfile
);

module.exports = router;
