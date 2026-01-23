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
const authorizeRoles = require("../middlewares/authorizeRoles");
const upload = require("../middlewares/multer");
const {
  updateProfile,
  getMe,
  getOrganizerDashboardStats,
} = require("../controllers/userController");
const { getOrganizerAttendees } = require("../controllers/eventController");

const router = express.Router();

router.post("/signup", signup);
router.post("/verify", isAuthenticated, verifyAccount);
router.post("/resend-otp", isAuthenticated, resendOTP);
router.post("/login", login);
router.post("/logout", logout);
router.post("/forget-password", forgetPassword);
router.post("/reset-password", resetPassword);
router.patch("/change-password", isAuthenticated, changePassword);

router.get("/me", isAuthenticated, getMe);

router.patch(
  "/update-profile",
  isAuthenticated,
  upload.single("profilePhoto"),
  updateProfile
);

router.get("/organizer/attendees", isAuthenticated, getOrganizerAttendees);

router.get(
  "/dashboard",
  isAuthenticated, // user must be logged in
  authorizeRoles("organizer"), // only organizers
  getOrganizerDashboardStats
);

module.exports = router;
