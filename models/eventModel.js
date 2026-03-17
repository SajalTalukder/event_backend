import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Event name is required"],
    },
    banner: {
      public_id: String,
      secure_url: {
        type: String,
        required: true,
      },
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["upcoming", "completed"],
      default: "upcoming",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    capacity: {
      type: Number,
      min: 1,
      default: 50,
    },
    category: {
      type: String,
      enum: [
        "Workshop",
        "Seminar",
        "Concert",
        "Conference",
        "Meetup",
        "Webinar",
        "Other",
      ],
      default: "Other",
    },
    additionalInfo: String,
    trainerName: String,
    guest: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    attendees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

const Event = mongoose.model("Event", eventSchema);

export default Event;
