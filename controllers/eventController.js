import sharp from "sharp";
import AppError from "../utils/appError.js";
import catchAsync from "../utils/catchAsync.js";
import Event from "../models/eventModel.js";
import User from "../models/userModel.js";
import getDataUri from "../utils/datauri.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";

// Get Event with filtering
export const getEvents = catchAsync(async (req, res, next) => {
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

  if (search) {
    filters.$or = [
      { name: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
    ];
  }

  if (maxPrice) {
    filters.price = { $lte: Number(maxPrice) };
  }

  if (trainerName) {
    filters.trainerName = { $regex: trainerName, $options: "i" };
  }

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
      .sort({ createdAt: -1 })
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
    data: { events },
  });
});

// Get latest events
export const getLatestEvents = catchAsync(async (req, res, next) => {
  const events = await Event.find({})
    .sort({ createdAt: -1 })
    .limit(6)
    .populate("createdBy", "username email");

  res.status(200).json({ status: "success", data: { events } });
});

// Get event by ID
export const getEventById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const event = await Event.findById(id).populate(
    "createdBy",
    "username organizationName profilePhoto organizationURL",
  );

  if (!event) return next(new AppError("Event not found", 404));

  res.status(200).json({ status: "success", data: { event } });
});

// Create event
export const createEvent = catchAsync(async (req, res, next) => {
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

  const bannerImage = req.file;
  if (!bannerImage)
    return next(new AppError("Event banner image is required", 400));

  // Date & Time validation
  const eventDateTime = new Date(`${date}T${time}`);
  if (eventDateTime <= new Date()) {
    return next(
      new AppError(
        "You cannot create an event in the past or earlier today",
        400,
      ),
    );
  }

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
    status,
    capacity,
    category,
  });

  await User.findByIdAndUpdate(userId, { $push: { createdEvents: event._id } });

  res
    .status(201)
    .json({ status: "success", message: "Event Created!", data: { event } });
});

// Update event
export const updateEvent = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const eventId = req.params.id;
  const event = await Event.findById(eventId);

  if (!event) return next(new AppError("Event not found", 404));
  if (event.createdBy.toString() !== userId.toString())
    return next(new AppError("Not authorized to update this event", 403));

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
    "capacity",
    "category",
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      event[field] =
        field === "date" ? new Date(req.body[field]) : req.body[field];
    }
  });

  if (req.file) {
    if (event.banner?.public_id)
      await deleteFromCloudinary(event.banner.public_id);

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

  await event.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: "Event updated successfully",
    data: { event },
  });
});

// Delete event
export const deleteEvent = catchAsync(async (req, res, next) => {
  const eventId = req.params.id;
  const userId = req.user._id;
  const event = await Event.findById(eventId);

  if (!event) return next(new AppError("Event not found", 404));
  if (!event.createdBy.equals(userId))
    return next(
      new AppError("You are not authorized to delete this event", 403),
    );

  if (event.banner?.public_id)
    await deleteFromCloudinary(event.banner.public_id);

  await User.findByIdAndUpdate(userId, { $pull: { createdEvents: eventId } });
  await User.updateMany(
    { registeredEvents: eventId },
    { $pull: { registeredEvents: eventId } },
  );
  await event.deleteOne();

  res
    .status(200)
    .json({ status: "success", message: "Event deleted successfully" });
});

// Register for event
export const registerEvent = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const eventId = req.params.id;
  const user = await User.findById(userId);
  if (!user) return next(new AppError("User not found", 404));

  const event = await Event.findById(eventId);
  if (!event) return next(new AppError("Event not found", 404));

  if (event.createdBy.toString() === userId.toString())
    return next(
      new AppError("Organizers cannot register for their own event", 400),
    );

  if (user.registeredEvents.includes(eventId))
    return next(new AppError("You are already registered for this event", 400));

  if (event.status === "completed" || new Date(event.date) < new Date())
    return next(
      new AppError(
        "Registration is closed. This event has already ended.",
        400,
      ),
    );

  if (event.attendees.length >= event.capacity)
    return next(new AppError("This event is already full.", 400));

  if (event.attendees.includes(userId))
    return next(new AppError("Already in event attendees", 400));

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

// Organizer-specific endpoints
export const getLoginOrganizerEvents = catchAsync(async (req, res, next) => {
  const organizerId = req.user.id;
  const { search, status, page = 1, limit = 10 } = req.query;
  const filter = { createdBy: organizerId };

  if (search) filter.name = { $regex: search, $options: "i" };
  if (status === "upcoming") filter.date = { $gte: new Date() };
  else if (status === "completed") filter.date = { $lt: new Date() };

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const totalEvents = await Event.countDocuments(filter);

  const events = await Event.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate({ path: "createdBy", select: "username profilePhoto" })
    .lean();

  res.status(200).json({
    status: "success",
    message: "Organizer Events",
    page: parseInt(page),
    limit: parseInt(limit),
    totalEvents,
    totalPages: Math.ceil(totalEvents / parseInt(limit)),
    results: events.length,
    data: { events },
  });
});

export const getOrganizerRecentEvents = catchAsync(async (req, res, next) => {
  const limit = 5;
  const organizer = req.user;
  if (!organizer || organizer.role !== "organizer")
    return next(new AppError("Only organizers can access their events", 403));

  const events = await Event.find({ createdBy: organizer._id })
    .sort({ createdAt: -1 })
    .limit(limit);

  if (!events) return next(new AppError("No events found", 404));

  res
    .status(200)
    .json({ status: "success", results: events.length, data: { events } });
});

export const getOrganizerAttendees = catchAsync(async (req, res, next) => {
  const organizerId = req.user._id;
  const { eventId } = req.query;
  let filter = { createdBy: organizerId };
  if (eventId) filter._id = eventId;

  const events = await Event.find(filter)
    .populate({ path: "attendees", select: "username email profilePhoto" })
    .select("name date time location attendees");

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
    data: { attendees: attendeesWithEvent.reverse() },
  });
});
