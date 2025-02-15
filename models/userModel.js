const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      required: [true, "Please provide a user name"],
    },
    email: {
      type: String,
      validate: [validator.isEmail, "Please provide a valid email"],
      required: [true, "Please provide a valid email"],
      unique: true,
      lowerCase: true,
    },
    new: {
      type: Boolean,
      default: true,
      select: false,
    },
    authType: {
      type: String,
      enum: {
        values: ["credentials", "google", "twitter", "facebook"],
        message:
          "Authtype is either: credentials, google, twitter or facebook ",
      },
      default: "credentials",
    },
    plan: {
      type: String,
      enum: {
        values: ["free", "individual", "organisation"],
        message: "Plan is either: free, individual or organisation ",
      },
      default: "free",
    },
    isSubscribed: {
      type: Boolean,
      default: false,
    },
    role: { type: String, default: "user" },

    // account is free until paid for
    // dont set anything for them
    // set it only once they pay
    subscriptionExpiryDate: {
      type: Date,
    },

    subscriptionStatus: {
      type: String,
      enum: ["active", "expired", "inactive"],
      required: true,
      default: "inactive",
    },

    logo: String,
    image: String,
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: [8, "Password must be at least 8 characters"],
    },
    confirmPassword: {
      type: String,
      validate: {
        validator: function (el) {
          return el === this.password;
        },
        message: "Passwords do not match!",
      },
      required: [true, "Please confirm your password"],
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    otp: { type: String, select: false },
    otpExpires: { type: Date, select: false },
    passwordResetTokenExpires: Date,
    latestTokenAssignedAt: Date,
    active: {
      type: Boolean,
      default: true,
      select: false,
    },
    organisationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organisation", // The organization the user belongs to
    },
    accounts: [
      {
        organisation: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Organisation",
        },
        organisationImage: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    accountType: {
      type: String,
      enum: {
        values: ["organisation", "individual"],
        message: "Account Type is either organisation or individual ",
      },
      required: [true, "Please provide an account type"],
    },
  },
  { timestamps: true }
);

userSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);

  this.confirmPassword = undefined;
  this.passwordChangedAt = new Date(Date.now() - 1000);
  next();
});

userSchema.methods.checkLatestToken = function (JWT_TIMESTAMP) {
  const tokenAssignedAtTimeStamp = parseInt(
    (this.latestTokenAssignedAt.getTime() / 1000).toString(),
    10
  );

  return tokenAssignedAtTimeStamp == JWT_TIMESTAMP;
};

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  console.log(candidatePassword);
  console.log(userPassword);
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changePasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      (this.passwordChangedAt.getTime() / 1000).toString(),
      10
    );
    return changedTimestamp > JWTTimestamp;
  }

  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  // create a random token
  const resetToken = crypto.randomBytes(32 / 2).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetTokenExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

userSchema.methods.generateOtp = async function () {
  const otp = crypto.randomInt(100000, 999999).toString();
  this.otp = await bcrypt.hash(otp, 10);
  this.otpExpires = Date.now() + process.env.OTP_EXPIRES_IN * 60 * 1000;

  return otp;
};

userSchema.methods.correctOTP = async function (otp) {
  return await bcrypt.compare(otp, this.otp);
};

// Create the User model
const User = mongoose.model("User", userSchema);

module.exports = User;
