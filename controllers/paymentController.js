// controllers/stripeController.js

import catchAsync from "../utils/catchAsync.js";
import stripe from "../utils/stripe.js";
import Event from "../models/eventModel.js";
import Payment from "../models/paymentModel.js";

// 1. Create / Get Stripe Account
export const connectStripeAccount = catchAsync(async (req, res) => {
  const user = req.user;

  let accountId = user.stripeAccountId;

  // 👉 jodi age na thake, new create korbo
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email,
      country: "US", // test mode e US rakhle easiest
    });

    accountId = account.id;

    user.stripeAccountId = accountId;

    await user.save({ validateBeforeSave: false });
  }

  // 2. Create onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.STRIPE_CLIENT_URL}/dashboard/profile`,
    return_url: `${process.env.STRIPE_CLIENT_URL}/dashboard/profile`,
    type: "account_onboarding",
  });

  res.status(200).json({
    status: "success",
    data: {
      user,
      url: accountLink.url,
    },
  });
});

export const getStripeAccountDetails = catchAsync(async (req, res) => {
  const user = req.user;

  if (!user.stripeAccountId) {
    return res.status(400).json({
      status: "fail",
      message: "No Stripe account connected",
    });
  }

  const account = await stripe.accounts.retrieve(user.stripeAccountId);

  const externalAccounts = await stripe.accounts.listExternalAccounts(
    user.stripeAccountId,
    { limit: 1 },
  );

  const bank = externalAccounts.data[0];

  res.status(200).json({
    status: "success",
    data: {
      stripe: {
        email: account.email,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        bank: bank
          ? {
              bankName: bank.bank_name,
              last4: bank.last4,
              currency: bank.currency,
            }
          : null,
      },
    },
  });
});

export const disconnectStripeAccount = catchAsync(async (req, res) => {
  const user = req.user;

  user.stripeAccountId = null;

  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: "Stripe disconnected",
    data: {
      user,
    },
  });
});

export const createCheckoutSession = async (req, res) => {
  const user = req.user;
  const eventId = req.params.id;

  const event = await Event.findById(eventId).populate("createdBy");

  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  if (!event.createdBy.stripeAccountId) {
    return res.status(400).json({
      message: "Organizer has not connected Stripe",
    });
  }

  // ❗ basic validation
  if (event.attendees.length >= event.capacity) {
    return res.status(400).json({ message: "Event full" });
  }

  // already registered?

  if (user.registeredEvents.includes(eventId)) {
    return res.status(400).json({
      message: "You already registered for this event",
    });
  }

  // ✅ Create Stripe session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",

    customer_email: user.email,

    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: event.price * 100,
          product_data: {
            name: event.name,
          },
        },
        quantity: 1,
      },
    ],

    // 💰 organizer gets money
    payment_intent_data: {
      application_fee_amount: Math.floor(event.price * 100 * 0.1),
      transfer_data: {
        destination: event.createdBy.stripeAccountId,
      },
    },

    // 🔥 IMPORTANT
    metadata: {
      eventId: eventId,
      userId: user._id.toString(),
    },

    success_url: `${process.env.CLIENT_URL}/payment-success`,
    cancel_url: `${process.env.CLIENT_URL}/event/${eventId}`,
  });

  // 👉 save pending payment
  await Payment.create({
    user: user._id,
    event: eventId,
    amount: event.price,
    stripeSessionId: session.id,
    status: "pending",
  });

  res.status(200).json({
    status: "success",
    url: session.url,
    data: {
      user,
    },
  });
};
