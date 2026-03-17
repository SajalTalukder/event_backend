import User from "../models/userModel.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import Event from "../models/eventModel.js";
import sharp from "sharp";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import getDataUri from "../utils/datauri.js";

/* ---------- GET ME ---------- */
export const getMe = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const user = await User.findById(userId)
    .select(
      "-password -passwordConfirm -otp -otpExpires -resetPasswordOTP -resetPasswordOTPExpires",
    )
    .populate("createdEvents")
    .populate("registeredEvents");

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  res.status(200).json({
    status: "success",
    message: "User profile fetched successfully",
    data: { user },
  });
});

/* ---------- UPDATE PROFILE ---------- */
export const updateProfile = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const role = req.user.role;

  const updateData = {
    username: req.body.username,
  };

  if (role === "organizer") {
    updateData.organizationName = req.body.organizationName;
    updateData.organizationURL = req.body.organizationURL;
    updateData.phoneNumber = req.body.phoneNumber;
  }

  // remove empty values
  Object.keys(updateData).forEach((key) => {
    if (!updateData[key]) delete updateData[key];
  });

  // profile photo upload
  if (req.file) {
    const resizedBuffer = await sharp(req.file.buffer)
      .resize(400, 400)
      .jpeg({ quality: 80 })
      .toBuffer();

    const fileUri = getDataUri({
      originalname: req.file.originalname.replace(/\.[^/.]+$/, ".jpeg"),
      buffer: resizedBuffer,
    });

    const cloudinaryRes = await uploadToCloudinary(fileUri);

    updateData.profilePhoto = {
      public_id: cloudinaryRes.public_id,
      secure_url: cloudinaryRes.secure_url,
    };
  }

  if (Object.keys(updateData).length === 0) {
    return next(new AppError("No valid fields provided for update", 400));
  }

  const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  }).select("-password");

  res.status(200).json({
    status: "success",
    message: "Profile updated successfully",
    data: { user: updatedUser },
  });
});

/* ---------- ORGANIZER DASHBOARD ---------- */
export const getOrganizerDashboardStats = catchAsync(async (req, res, next) => {
  const organizerId = req.user._id;

  if (req.user.role !== "organizer") {
    return next(new AppError("Only organizers can access dashboard", 403));
  }

  const now = new Date();

  const startOfPreviousMonth = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1,
  );

  const endOfPreviousMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
  );

  // current events
  const events = await Event.find({ createdBy: organizerId });

  let totalAttendees = 0;
  let totalRevenue = 0;

  events.forEach((event) => {
    totalAttendees += event.attendees.length;
    totalRevenue += event.price * event.attendees.length;
  });

  const totalEvents = events.length;

  // previous month
  const prevMonthEvents = await Event.find({
    createdBy: organizerId,
    createdAt: {
      $gte: startOfPreviousMonth,
      $lte: endOfPreviousMonth,
    },
  });

  let prevAttendees = 0;
  let prevRevenue = 0;

  prevMonthEvents.forEach((event) => {
    prevAttendees += event.attendees.length;
    prevRevenue += event.price * event.attendees.length;
  });

  const growthPercent = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(2));
  };

  res.status(200).json({
    status: "success",
    data: {
      totals: {
        totalEvents,
        totalAttendees,
        totalRevenue,
      },
      growth: {
        events: growthPercent(totalEvents, prevMonthEvents.length),
        attendees: growthPercent(totalAttendees, prevAttendees),
        revenue: growthPercent(totalRevenue, prevRevenue),
      },
    },
  });
});
