const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const sharp = require("sharp");
const { uploadToCloudinary } = require("../utils/cloudinary");
const getDataUri = require("../utils/datauri");

exports.getMe = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const user = await User.findById(userId)
    .select(
      "-password -passwordConfirm -otp -otpExpires -resetPasswordOTP -resetPasswordOTPExpires"
    )
    .populate({
      path: "createdEvents",
      select: "name banner.secure_url date location price",
    })
    .populate({
      path: "registeredEvents",
      select: "name banner.secure_url date location price",
    });

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  res.status(200).json({
    status: "success",
    message: "User profile fetched successfully",
    data: {
      user,
    },
  });
});

exports.updateProfile = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const role = req.user.role;

  // Common fields
  const updateData = {
    username: req.body.username,
  };

  // Organizer-only fields
  if (role === "organizer") {
    updateData.organizationName = req.body.organizationName;
    updateData.organizationURL = req.body.organizationURL;
    updateData.phoneNumber = req.body.phoneNumber;
  }

  // Remove undefined/null/empty string values
  Object.keys(updateData).forEach((key) => {
    if (!updateData[key]) delete updateData[key];
  });

  // Handle profile picture upload (if any)
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

  // No fields to update
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
