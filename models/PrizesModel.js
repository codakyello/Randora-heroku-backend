const mongoose = require("mongoose");

const prizeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  image: {
    type: String,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 1,
  },
  totalQuantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },
  organisationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organisation",
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

prizeSchema.pre("save", function (next) {
  this.updatedAt = Date.now(); // Set the updated date before saving
  next();
});

// Create the model
const Prize = mongoose.model("Prize", prizeSchema);

module.exports = Prize;
