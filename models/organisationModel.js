const mongoose = require("mongoose");

const organisationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // The user who created the organization (i.e., the admin/owner)
    required: true,
  },
  // start by giving them free 7 days trial
  subscriptionExpiryDate: {
    type: Date,
    default: () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
  },

  subscriptionStatus: {
    type: String,
    enum: ["active", "expired"],
    required: true,
    default: "active",
  },
  collaborators: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      token: {
        type: String, // Used for invites
      },
      status: {
        type: String,
        enum: ["pending", "accepted", "declined"],
        default: "pending", // Default status for invites
      },
      addedAt: {
        type: Date,
        default: Date.now, // When the user was added as a collaborator
      },
      expiresAt: {
        type: Date, // Expiry date for invites
        default: () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 2), // Default: 2 days
      },
    },
  ],
  textLogo: {
    type: String, // URL or text for the text logo
  },
  coverLogo: {
    type: String, // URL for the cover logo
  },
  brandColor: {
    type: String, // Hex color code or valid CSS color value
    default: "#000000", // Default to black
  },
});

organisationSchema.pre(/^find/, function (next) {
  this.populate({
    path: "collaborators.user", // Path to populate
    select: "userName email image _id", // Select specific fields from User
  });
  next();
});

const Organisation =
  mongoose.models.Organisation ||
  mongoose.model("Organisation", organisationSchema);

module.exports = Organisation;
