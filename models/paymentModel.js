// models/paymentModel.js

import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
  },
  amount: Number,
  stripeSessionId: String,
  status: {
    type: String,
    enum: ["pending", "paid"],
    default: "pending",
  },
});

export default mongoose.model("Payment", paymentSchema);
