// controllers/webhookController.js

import stripe from "../utils/stripe.js";
import User from "../models/userModel.js";
import Event from "../models/eventModel.js";
import Payment from "../models/paymentModel.js";

export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 🎯 Payment success
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const eventId = session.metadata.eventId;
    const userId = session.metadata.userId;

    const user = await User.findById(userId);
    const eventDoc = await Event.findById(eventId);

    if (!user || !eventDoc) return;

    // 🔥 validation again
    if (eventDoc.createdBy.toString() === userId) return;
    if (user.registeredEvents.includes(eventId)) return;
    if (eventDoc.attendees.length >= eventDoc.capacity) return;

    // ✅ register user
    user.registeredEvents.push(eventId);
    eventDoc.attendees.push(userId);

    await Promise.all([
      user.save({ validateBeforeSave: false }),
      eventDoc.save({ validateBeforeSave: false }),
    ]);

    // ✅ update payment
    await Payment.findOneAndUpdate(
      { stripeSessionId: session.id },
      { status: "paid" },
    );
  }

  res.status(200).json({ received: true });
};
