const sharp = require("sharp");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const Event = require("../models/eventModel");
const User = require("../models/userModel");
const getDataUri = require("../utils/datauri");
const { uploadToCloudinary } = require("../utils/cloudinary");

// Get Event with filtering
exports.getEvents = catchAsync(async (req, res, next) => {
  const {
    search,
    maxPrice,
    trainerName,
    dateFrom,
    dateTo,
    page = 1,
    limit = 10,
  } = req.query;

  const filters = {};

  // Text search in name or location
  if (search) {
    filters.$or = [
      { name: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
    ];
  }

  // Max price filter
  if (maxPrice) {
    filters.price = { $lte: Number(maxPrice) };
  }

  // Trainer name match
  if (trainerName) {
    filters.trainerName = { $regex: trainerName, $options: "i" };
  }

  // Date range filter
  if (dateFrom || dateTo) {
    filters.date = {};
    if (dateFrom) filters.date.$gte = new Date(dateFrom);
    if (dateTo) filters.date.$lte = new Date(dateTo);
  }

  const pageNumber = Number(page) || 1;
  const limitNumber = Number(limit) || 10;
  const skip = (pageNumber - 1) * limitNumber;

  const [events, total] = await Promise.all([
    Event.find(filters)
      .sort({ date: 1 }) // sort by soonest
      .skip(skip)
      .limit(limitNumber)
      .populate("createdBy", "username email"),
    Event.countDocuments(filters),
  ]);

  res.status(200).json({
    status: "success",
    total,
    page: pageNumber,
    count: events.length,
    data: {
      events,
    },
  });
});

// Create event

exports.createEvent = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const {
    name,
    description,
    price,
    date,
    time,
    location,
    additionalInfo,
    trainer,
    guest,
  } = req.body;

  // Check for banner image
  const bannerImage = req.file;
  if (!bannerImage) {
    return next(new AppError("Event banner image is required", 400));
  }

  // Optimize and upload to Cloudinary
  const optimizedBuffer = await sharp(bannerImage.buffer)
    .resize({ width: 1200, height: 800, fit: "cover" })
    .toFormat("jpeg", { quality: 80 })
    .toBuffer();

  // Create a mock file object for getDataUri
  const optimizedFile = {
    originalname: req.file.originalname.replace(/\.[^/.]+$/, ".jpeg"), // ensure extension is jpeg
    buffer: optimizedBuffer,
  };

  // Use getDataUri
  const fileUri = getDataUri(optimizedFile);

  const cloudResponse = await uploadToCloudinary(fileUri);

  // Create the event
  const event = await Event.create({
    name,
    description,
    price,
    date,
    time,
    location,
    additionalInfo,
    trainer,
    guest,
    banner: {
      publicId: cloudResponse.public_id,
      secure_url: cloudResponse.secure_url,
    },
    createdBy: userId,
  });

  // Add event ID to the organizer’s createdEvents array
  await User.findByIdAndUpdate(userId, {
    $push: { createdEvents: event._id },
  });

  res.status(201).json({
    status: "success",
    message: "Evenet Created!",
    data: {
      event,
    },
  });
});

// Update event

exports.updateEvent = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const eventId = req.params.id;

  // Step 1: Fetch event
  const event = await Event.findById(eventId);
  if (!event) return next(new AppError("Event not found", 404));

  // Step 2: Authorization check
  if (event.createdBy.toString() !== userId.toString()) {
    return next(new AppError("Not authorized to update this event", 403));
  }

  // Step 3: Dynamically update allowed fields
  const allowedFields = [
    "name",
    "description",
    "price",
    "date",
    "time",
    "location",
    "additionalInfo",
    "trainer",
    "guest",
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      event[field] =
        field === "date" ? new Date(req.body[field]) : req.body[field];
    }
  });

  // Step 4: Handle banner update if image is provided
  if (req.file) {
    if (event.banner?.public_id) {
      await deleteFromCloudinary(event.banner.public_id);
    }

    const optimizedBuffer = await sharp(req.file.buffer)
      .resize({ width: 1200, height: 800, fit: "cover" })
      .toFormat("jpeg", { quality: 80 })
      .toBuffer();

    const optimizedFile = {
      originalname: req.file.originalname.replace(/\.[^/.]+$/, ".jpeg"),
      buffer: optimizedBuffer,
    };

    const fileUri = getDataUri(optimizedFile);
    const cloudResponse = await uploadToCloudinary(fileUri);

    event.banner = {
      publicId: cloudResponse.public_id,
      secure_url: cloudResponse.secure_url,
    };
  }

  // Step 5: Save updated event
  await event.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: "Event updated successfully",
    data: { event },
  });
});

// Delete Event
exports.deleteEvent = catchAsync(async (req, res, next) => {
  const eventId = req.params.id;
  const userId = req.user._id;

  const event = await Event.findById(eventId);

  if (!event) {
    return next(new AppError("Event not found", 404));
  }

  // Check ownership
  if (!event.createdBy.equals(userId)) {
    return next(
      new AppError("You are not authorized to delete this event", 403)
    );
  }

  // Delete image from Cloudinary
  if (event.banner?.public_id) {
    await deleteFromCloudinary(event.banner.public_id);
  }

  // Remove event reference from the organizer
  await User.findByIdAndUpdate(userId, {
    $pull: { createdEvents: eventId },
  });

  // Delete the event
  await event.deleteOne();

  res.status(200).json({
    status: "success",
    message: "Event deleted successfully",
  });
});
