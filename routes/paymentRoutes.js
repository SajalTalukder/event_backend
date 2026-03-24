// routes/stripeRoutes.js

import express from "express";
import {
  connectStripeAccount,
  createCheckoutSession,
  disconnectStripeAccount,
  getStripeAccountDetails,
} from "../controllers/paymentController.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import { stripeWebhook } from "../controllers/webhookController.js";

const router = express.Router();

router.post(
  "/connect",
  isAuthenticated,
  authorizeRoles("organizer"), // user logged in thakte hobe
  connectStripeAccount,
);

router.get(
  "/stripe-info",
  isAuthenticated,
  authorizeRoles("organizer"),
  getStripeAccountDetails,
);
router.delete(
  "/disconnect",
  isAuthenticated,
  authorizeRoles("organizer"),
  disconnectStripeAccount,
);

router.post("/checkout/:id", isAuthenticated, createCheckoutSession);

export default router;
