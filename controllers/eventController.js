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
      .sort({ createdAt: -1 }) // sort by soonest
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

exports.getLatestEvents = catchAsync(async (req, res, next) => {
  const events = await Event.find({})
    .sort({ createdAt: -1 }) // Sort by newest
    .limit(6); // Limit to 6 or 7

  res.status(200).json({
    status: "success",
    data: {
      events,
    },
  });
});

exports.getEventById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  console.log(id);

  const event = await Event.findById(id).populate(
    "createdBy",
    "username organizationName profilePhoto organizationURL"
  );
  console.log(event);

  if (!event) {
    return next(new AppError("Event not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      event,
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
    trainerName,
    guest,
    capacity,
    category,
  } = req.body;

  console.log("Trainer name ", trainerName);

  // Check for banner image
  const bannerImage = req.file;
  if (!bannerImage) {
    return next(new AppError("Event banner image is required", 400));
  }

  // 🔹 Date & Time Validation
  const eventDateTime = new Date(`${date}T${time}`);
  const now = new Date();

  if (eventDateTime <= now) {
    return next(
      new AppError(
        "You cannot create an event in the past or earlier today",
        400
      )
    );
  }

  // 🔹 Always set status to "upcoming" for valid future events
  const status = "upcoming";

  // Optimize and upload to Cloudinary
  const optimizedBuffer = await sharp(bannerImage.buffer)
    .resize({ width: 1200, height: 800, fit: "cover" })
    .toFormat("jpeg", { quality: 80 })
    .toBuffer();

  const optimizedFile = {
    originalname: req.file.originalname.replace(/\.[^/.]+$/, ".jpeg"),
    buffer: optimizedBuffer,
  };

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
    trainerName,
    guest,
    banner: {
      publicId: cloudResponse.public_id,
      secure_url: cloudResponse.secure_url,
    },
    createdBy: userId,
    status, // 🔹 Added here
    capacity,
    category,
  });

  // Add event ID to the organizer’s createdEvents array
  await User.findByIdAndUpdate(userId, {
    $push: { createdEvents: event._id },
  });

  res.status(201).json({
    status: "success",
    message: "Event Created!",
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
    "trainerName",
    "guest",
    "capacity", // ✅ added
    "category", // ✅ added
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

exports.deleteEvent = catchAsync(async (req, res, next) => {
  const eventId = req.params.id;
  const userId = req.user._id;

  const event = await Event.findById(eventId);
  if (!event) {
    return next(new AppError("Event not found", 404));
  }

  // Authorization check
  if (!event.createdBy.equals(userId)) {
    return next(
      new AppError("You are not authorized to delete this event", 403)
    );
  }

  // Delete image from Cloudinary
  if (event.banner?.public_id) {
    await deleteFromCloudinary(event.banner.public_id);
  }

  // Remove event from organizer
  await User.findByIdAndUpdate(userId, {
    $pull: { createdEvents: eventId },
  });

  // ❗ Remove event from all participants' registerdEvents
  await User.updateMany(
    { registerdEvents: eventId },
    { $pull: { registerdEvents: eventId } }
  );

  // Delete the actual event
  await event.deleteOne();

  res.status(200).json({
    status: "success",
    message: "Event deleted successfully",
  });
});

exports.registerEvent = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const eventId = req.params.id;

  const user = await User.findById(userId);
  if (!user) return next(new AppError("User not found", 404));

  const event = await Event.findById(eventId);
  if (!event) return next(new AppError("Event not found", 404));

  // Prevent organizer from registering their own event
  if (event.createdBy.toString() === userId.toString()) {
    return next(
      new AppError("Organizers cannot register for their own event", 400)
    );
  }

  // Check if user already registered
  if (user.registeredEvents.includes(eventId)) {
    return next(new AppError("You are already registered for this event", 400));
  }

  // Check if user is already in event's attendees
  if (event.attendees.includes(userId)) {
    return next(new AppError("Already in event attendees", 400));
  }

  // Register user
  user.registeredEvents.push(eventId);
  event.attendees.push(userId);

  await Promise.all([
    user.save({ validateBeforeSave: false }),
    event.save({ validateBeforeSave: false }),
  ]);

  res.status(200).json({
    status: "success",
    message: "Successfully registered for the event",
  });
});

exports.getLoginOrganizerEvents = catchAsync(async (req, res, next) => {
  const organizerId = req.user.id;
  const { search, status, page = 1, limit = 10 } = req.query;

  const filter = { createdBy: organizerId };

  // 1) Search filter
  if (search) {
    filter.name = { $regex: search, $options: "i" };
  }

  // 2) Status filter
  if (status === "upcoming") {
    filter.date = { $gte: new Date() };
  } else if (status === "completed") {
    filter.date = { $lt: new Date() };
  }

  // Convert pagination params to numbers
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get total for pagination
  const totalEvents = await Event.countDocuments(filter);

  // Query with filters + pagination
  const events = await Event.find(filter)
    .sort({ createdAt: -1 }) // latest first
    .skip(skip)
    .limit(parseInt(limit))
    .populate({
      path: "createdBy",
      select: "username profilePhoto",
    })
    .lean();

  res.status(200).json({
    status: "success",
    message: "Organizer Events",
    page: parseInt(page),
    limit: parseInt(limit),
    totalEvents,
    totalPages: Math.ceil(totalEvents / parseInt(limit)),
    results: events.length,
    data: {
      events,
    },
  });
});

exports.getOrganizerRecentEvents = catchAsync(async (req, res, next) => {
  console.log("Fetching recent events for organizer");

  const limit = 5;
  const organizer = req.user;

  if (!organizer || organizer.role !== "organizer") {
    return next(new AppError("Only organizers can access their events", 403));
  }

  const events = await Event.find({ createdBy: organizer._id })
    .sort({ createdAt: -1 })
    .limit(limit);

  if (!events) return next(new AppError("No events found", 404));

  res.status(200).json({
    status: "success",
    results: events.length,
    data: {
      events,
    },
  });
});

// Get attendees for all events of a logged-in organizer
exports.getOrganizerAttendees = catchAsync(async (req, res, next) => {
  const organizerId = req.user._id;
  const { eventId } = req.query;

  let filter = { createdBy: organizerId };
  if (eventId) filter._id = eventId;

  const events = await Event.find(filter)
    .populate({
      path: "attendees",
      select: "username email profilePhoto",
    })
    .select("name date time location attendees");

  // 🔥 Flat array with attendee + event info
  const attendeesWithEvent = [];

  events.forEach((event) => {
    event.attendees.forEach((user) => {
      attendeesWithEvent.push({
        attendeeId: user._id,
        username: user.username,
        email: user.email,
        profilePhoto: user.profilePhoto,
        eventId: event._id,
        eventName: event.name,
        eventDate: event.date,
        eventTime: event.time,
        eventLocation: event.location,
      });
    });
  });

  res.status(200).json({
    status: "success",
    totalEvents: events.length,
    totalAttendees: attendeesWithEvent.length,
    data: {
      attendees: attendeesWithEvent.reverse(),
    },
  });
});
