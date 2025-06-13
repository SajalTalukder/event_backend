const express = require("express");
const isAuthenticated = require("../middlewares/isAuthenticated");
const {
  createEvent,
  getEvents,
  updateEvent,
  deleteEvent,
} = require("../controllers/eventController");
const authorizeRoles = require("../middlewares/authorizeRoles");
const upload = require("../middlewares/multer");

const router = express.Router();

router.get("/all-events", getEvents);

router.post(
  "/create-event",
  isAuthenticated,
  authorizeRoles("organizer", "admin"),
  upload.single("banner"),
  createEvent
);

router.patch(
  "/update-event/:id",
  isAuthenticated,
  authorizeRoles("organizer"),
  upload.single("banner"),
  updateEvent
);

router.delete(
  "/delete-event/:id",
  isAuthenticated,
  authorizeRoles("organizer"),
  deleteEvent
);

module.exports = router;
