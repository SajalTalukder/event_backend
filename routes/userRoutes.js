import express from "express";

import {
  signup,
  verifyAccount,
  resendOTP,
  login,
  logout,
  forgetPassword,
  resetPassword,
  changePassword,
} from "../controllers/authController.js";

import {
  updateProfile,
  getMe,
  getOrganizerDashboardStats,
} from "../controllers/userController.js";

import { getOrganizerAttendees } from "../controllers/eventController.js";

import isAuthenticated from "../middlewares/isAuthenticated.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import upload from "../middlewares/multer.js";

const router = express.Router();

// Auth routes
router.post("/signup", signup);
router.post("/verify", isAuthenticated, verifyAccount);
router.post("/resend-otp", isAuthenticated, resendOTP);
router.post("/login", login);
router.post("/logout", logout);
router.post("/forget-password", forgetPassword);
router.post("/reset-password", resetPassword);
router.patch("/change-password", isAuthenticated, changePassword);

// User routes
router.get("/me", isAuthenticated, getMe);
router.patch(
  "/update-profile",
  isAuthenticated,
  upload.single("profilePhoto"),
  updateProfile,
);

// Organizer routes
router.get("/organizer/attendees", isAuthenticated, getOrganizerAttendees);
router.get(
  "/dashboard",
  isAuthenticated,
  authorizeRoles("organizer"),
  getOrganizerDashboardStats,
);

export default router;
