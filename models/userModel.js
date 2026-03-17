import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import validator from "validator";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Please tell us your name"],
    },
    email: {
      type: String,
      required: [true, "Please provide your email"],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "Please provide a valid email"],
    },
    profilePhoto: {
      public_id: String,
      secure_url: {
        type: String,
        default: "",
      },
    },
    phoneNumber: {
      type: String,
      validate: {
        validator: function (val) {
          return this.role === "organizer"
            ? validator.isMobilePhone(val)
            : true;
        },
        message: "Please provide a valid phone number",
      },
    },
    organizationName: {
      type: String,
      required: function () {
        return this.role === "organizer";
      },
    },
    organizationURL: {
      type: String,
      validate: {
        validator: function (val) {
          return this.role === "organizer" ? validator.isURL(val) : true;
        },
        message: "Please provide a valid URL",
      },
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: 8,
      select: false,
    },
    passwordConfirm: {
      type: String,
      required: [true, "Please confirm your password"],
      validate: {
        validator: function (el) {
          return el === this.password;
        },
        message: "Passwords are not the same!",
      },
    },
    role: {
      type: String,
      enum: ["participant", "organizer", "admin"],
      default: "participant",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: String,
    otpExpires: Date,
    resetPasswordOTP: String,
    resetPasswordOTPExpires: Date,

    createdEvents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
      },
    ],
    registeredEvents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
      },
    ],
  },
  { timestamps: true },
);

/* ---------- MIDDLEWARE ---------- */
// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
  next();
});

/* ---------- METHODS ---------- */
// Compare passwords
userSchema.methods.correctPassword = async function (candidate, real) {
  return await bcrypt.compare(candidate, real);
};

const User = mongoose.model("User", userSchema);

export default User;
