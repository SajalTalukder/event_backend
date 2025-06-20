const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const sharp = require("sharp");
const { uploadToCloudinary } = require("../utils/cloudinary");
const getDataUri = require("../utils/datauri");

exports.updateProfile = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const role = req.user.role;

  // Allow common fields
  const allowedFields = ["username"];

  // Organizer-only fields
  if (role === "organizer") {
    allowedFields.push("organizationName", "organizationUrl", "phoneNumber");
  }

  // Filter only allowed fields from req.body
  const updateData = {};
  for (const field of allowedFields) {
    if (req.body[field]) {
      updateData[field] = req.body[field];
    }
  }

  // Handle profilePhoto update
  if (req.file) {
    const optimizedBuffer = await sharp(req.file.buffer)
      .resize({ width: 400, height: 400, fit: "cover" })
      .toFormat("jpeg", { quality: 80 })
      .toBuffer();

    const optimizedFile = {
      originalname: req.file.originalname.replace(/\.[^/.]+$/, ".jpeg"),
      buffer: optimizedBuffer,
    };

    const fileUri = getDataUri(optimizedFile);
    const cloudResult = await uploadToCloudinary(fileUri);

    updateData.profilePhoto = {
      publicId: cloudResult.public_id,
      url: cloudResult.secure_url,
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
    data: updatedUser,
  });
});
