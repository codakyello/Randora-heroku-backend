const mongoose = require("mongoose");
const Participant = require("./ParticipantsModel");
const Prize = require("./PrizesModel");
const { Schema } = mongoose;

const eventSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["Raffle", "Spin", "Trivia"],
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  organisationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organisation",
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  csvUploaded: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ["active", "inactive", "completed", "cancelled"],
    default: "inactive",
  },
  emailSent: {
    type: Boolean,
    default: false,
  },
  participantCount: { type: Number, default: 0 },
  prizeCount: { type: Number, default: 0 },
  remainingPrize: { type: Number, default: 0, min: 0 },
});

eventSchema.pre(/^find/, function (next) {
  this.populate("creator");
  next();
});

eventSchema.statics.updateParticipantsCount = async function (eventId) {
  console.log("update participant Count");
  const count = await Participant.countDocuments({ eventId });
  console.log(count);
  await this.findByIdAndUpdate(eventId, { participantCount: count });
};

eventSchema.statics.updatePrizeCount = async function (eventId) {
  let count = 0;
  const prizes = await Prize.find({ eventId });

  prizes.forEach((prize) => (count += prize.quantity));

  await this.findByIdAndUpdate(eventId, { prizeCount: count });
};

eventSchema.statics.updateRemainingPrizeCount = async function (eventId) {
  let count = 0;
  const prizes = await Prize.find({ eventId });

  prizes.forEach((prize) => (count += prize.quantity));

  await this.findByIdAndUpdate(eventId, { remainingPrize: count });
};

// Create the model
const Event = mongoose.model("Event", eventSchema);

module.exports = Event;
