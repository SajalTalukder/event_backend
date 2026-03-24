import cron from "cron";
import https from "https";
import Event from "../models/eventModel.js";

// ===== Prevent Multiple Starts =====
let isStarted = false;

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
      console.error("❌ Keep-alive error:", e.message);
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
      console.log(`✅ Events updated: ${updated.modifiedCount}`);
    }
  } catch (err) {
    console.error("❌ Event update error:", err.message);
  }
});

// ===== Start Jobs Safely =====
export const startAll = () => {
  if (isStarted) {
    console.log("⚠️ Cron already running, skipping...");
    return;
  }

  keepAliveJob.start();
  eventStatusJob.start();

  isStarted = true;

  console.log("⏳ Cron jobs started once");
};
