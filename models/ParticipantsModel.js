const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      "Please enter a valid email address",
    ],
    default: null,
  },
  ticketNumber: {
    type: String,
    required: true,
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isWinner: {
    type: Boolean,
    default: false,
  },
  prize: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Prize",
  },
});

participantSchema.pre(/^find/, function (next) {
  this.populate("prize");
  next();
});

participantSchema.index({ ticketNumber: 1, eventId: 1 });

const Participant = mongoose.model("Participant", participantSchema);

module.exports = Participant;
