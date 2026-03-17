import cron from "cron";
import https from "https";
import Event from "../models/eventModel.js"; // make sure path is correct

// ===== Render Keep Alive Job =====
const URL = "https://eventify-ncnv.onrender.com";

const keepAliveJob = new cron.CronJob("*/14 * * * *", function () {
  https
    .get(URL, (res) => {
      if (res.statusCode === 200) {
        console.log("🌐 Keep-alive request sent successfully");
      } else {
        console.log("❌ Keep-alive request failed", res.statusCode);
      }
    })
    .on("error", (e) => {
      console.error("Error while sending keep-alive request", e);
    });
});

// ===== Event Status Updater Job =====
const eventStatusJob = new cron.CronJob("0 0 * * *", async function () {
  try {
    const now = new Date();
    const updated = await Event.updateMany(
      { date: { $lt: now }, status: "upcoming" },
      { $set: { status: "completed" } },
    );
    if (updated.modifiedCount > 0) {
      console.log(`✅ Events marked as completed: ${updated.modifiedCount}`);
    }
  } catch (err) {
    console.error("❌ Error updating event statuses:", err);
  }
});

// ===== Export and Start Jobs =====
export const startAll = () => {
  keepAliveJob.start();
  eventStatusJob.start();
  console.log("⏳ All cron jobs started");
};
