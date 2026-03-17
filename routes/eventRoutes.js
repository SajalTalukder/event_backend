import express from "express";

import isAuthenticated from "../middlewares/isAuthenticated.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import upload from "../middlewares/multer.js";

import {
  createEvent,
  getEvents,
  updateEvent,
  deleteEvent,
  getEventById,
  registerEvent,
  getLatestEvents,
  getLoginOrganizerEvents,
  getOrganizerRecentEvents,
} from "../controllers/eventController.js";

const router = express.Router();

router.get("/all-events", getEvents);

router.get("/single/:id", getEventById);

router.post(
  "/create-event",
  isAuthenticated,
  authorizeRoles("organizer", "admin"),
  upload.single("banner"),
  createEvent,
);

router.patch(
  "/update-event/:id",
  isAuthenticated,
  authorizeRoles("organizer"),
  upload.single("banner"),
  updateEvent,
);

router.delete(
  "/delete-event/:id",
  isAuthenticated,
  authorizeRoles("organizer"),
  deleteEvent,
);

router.post("/register/:id", isAuthenticated, registerEvent);

router.get("/latest", getLatestEvents);

router.get("/organizer-events", isAuthenticated, getLoginOrganizerEvents);

router.get(
  "/organizer-recent-events",
  isAuthenticated,
  getOrganizerRecentEvents,
);

export default router;
