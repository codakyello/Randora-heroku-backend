const Prize = require("../models/PrizesModel");
const Participant = require("../models/ParticipantsModel");
const Event = require("../models/EventModel");
const { catchAsync, sendSuccessResponseData } = require("../utils/helpers");
const APIFEATURES = require("../utils/apiFeatures");
const AppError = require("../utils/appError");
const User = require("../models/userModel");
const Organisation = require("../models/organisationModel");

module.exports.getAllEvents = catchAsync(async (req, res) => {
  const apiFeatures = new APIFEATURES(Event, req.query)
    .filter()
    .sort()
    .paginate()
    .limitFields();

  const totalCount = Event.countDocuments();

  const events = await apiFeatures.query;

  sendSuccessResponseData(res, "events", events, totalCount);
});

module.exports.getAllEvents = catchAsync(async (req, res) => {
  const apiFeatures = new APIFEATURES(Event, req.query)
    .filter()
    .sort()
    .paginate()
    .limitFields();

  const totalCount = Event.countDocuments();

  const events = await apiFeatures.query;

  sendSuccessResponseData(res, "events", events, totalCount);
});
// get events
module.exports.getEvent = catchAsync(async (req, res) => {
  // check if the user owns the event
  const user = req.user;
  const event = await Event.findById(req.params.id).populate("creator");

  // check if the user owns the event
  //
  if (
    event.organisationId?.toString() !== user.organisationId?.toString() &&
    event.userId?.toString() !== user._id?.toString()
  ) {
    throw new AppError("You do not have permission to access this event.", 404);
  }

  if (!event) {
    throw new AppError("No event found with that ID.", 404);
  }

  sendSuccessResponseData(res, "event", event);
});

module.exports.createEvent = catchAsync(async (req, res) => {
  const { name } = req.body;

  // Check if the user is part of an organisation
  const organisationId = req.user.organisationId;

  let subscriptionStatus;

  if (organisationId) {
    const organisation = await Organisation.findById(organisationId);
    subscriptionStatus = organisation?.subscriptionStatus;
  } else {
    const user = await User.findById(req.user.id);
    subscriptionStatus = user?.isSubscribed;
  }

  // Define the filter for event ownership
  const filter = organisationId ? { organisationId } : { userId: req.user.id };

  // Get all events associated with the organisation or user
  const events = await Event.find(filter);

  // Check if the subscription allows creating more events
  if (
    (!subscriptionStatus || subscriptionStatus !== "active") &&
    events.length >= 10
  ) {
    throw new AppError("Please upgrade your plan to create more events.", 402);
  }

  // Check if an event with the same name already exists for the user/org
  const existingEvent = await Event.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
    ...filter,
  });

  if (existingEvent) {
    throw new AppError("An event with this name already exists.", 400);
  }

  // Create the new event
  const newEvent = await Event.create({
    ...req.body,
    ...(organisationId
      ? { organisationId, creator: req.user.id }
      : { userId: req.user.id, creator: req.user.id }),
  });

  sendSuccessResponseData(res, "event", newEvent);
});

module.exports.updateEvent = catchAsync(async (req, res) => {
  const event = await Event.findById(req.params.id);

  if (
    event.organisationId?.toString() !== req.user.organisationId?.toString() &&
    event.userId?.toString() !== req.user._id?.toString()
  ) {
    throw new AppError("You do not have permission to access this event.", 404);
  }

  const { name } = req.body;
  const filter = event.organisationId
    ? { name, organisationId: event.organisationId }
    : { name, userId: event.userId };

  const existingEvent = await Event.findOne(filter);
  if (existingEvent && existingEvent._id.toString() !== event._id.toString()) {
    throw new AppError("An event with this name already exists.", 400);
  }

  if (!event) {
    throw new AppError("No event found with that ID.", 404);
  }

  if (event.status === "completed") {
    throw new AppError(`Cannot update a ${event.status} event.`, 400);
  }

  Object.keys(req.body).forEach((key) => {
    event[key] = req.body[key];
  });

  await event.save();
  sendSuccessResponseData(res, "event", event);
});

module.exports.deleteEvent = catchAsync(async (req, res) => {
  const { id } = req.params;

  const event = await Event.findById(id);

  if (
    event.organisationId?.toString() !== req.user.organisationId?.toString() &&
    event.userId?.toString() !== req.user._id?.toString()
  ) {
    throw new AppError("You do not have permission to access this event.", 404);
  }
  if (!event) {
    throw new AppError("No event found with that ID.", 404);
  }

  if (event.status === "active") {
    throw new AppError("You cannot delete an ongoing event.", 400);
  }

  await Promise.all([
    Prize.deleteMany({ eventId: id }),
    Participant.deleteMany({ eventId: id }),
  ]);

  await Event.findByIdAndDelete(id);

  sendSuccessResponseData(res, "event");
});

module.exports.getEventParticipants = catchAsync(async (req, res) => {
  const event = await Event.findById(req.params.id);

  if (
    event.organisationId?.toString() !== req.user.organisationId?.toString() &&
    event.userId?.toString() !== req.user._id?.toString()
  ) {
    throw new AppError("You do not have permission to access this event.", 404);
  }

  const apiFeatures = new APIFEATURES(
    Participant.find({ eventId: req.params.id }).populate("prize"),
    req.query
  )
    .filter()
    .sort()
    .paginate()
    .limitFields();

  const totalCount = await Participant.find({
    eventId: req.params.id,
  }).countDocuments();

  const participants = await apiFeatures.query;

  sendSuccessResponseData(res, "participants", participants, totalCount);
});

module.exports.getEventAllParticipants = catchAsync(async (req, res) => {
  const event = await Event.findById(req.params.id);

  if (
    event.organisationId?.toString() !== req.user.organisationId?.toString() &&
    event.userId?.toString() !== req.user._id?.toString()
  ) {
    throw new AppError("You do not have permission to access this event.", 404);
  }

  const participants = await Participant.find({ eventId: req.params.id });

  const totalCount = await Participant.find({
    eventId: req.params.id,
  }).countDocuments();

  sendSuccessResponseData(res, "participants", participants, totalCount);
});

module.exports.getEventWinners = catchAsync(async (req, res) => {
  const eventId = req.params.id;
  const totalCount = await Participant.find({
    eventId,
  }).countDocuments();

  // Check if event has winners
  const eventWinners = await Participant.find({ eventId, isWinner: true });
  if (eventWinners.length) {
    return sendSuccessResponseData(
      res,
      "participants",
      eventWinners,
      totalCount
    );
  }

  const participants = await Participant.find({ eventId }).limit(10);

  // Send response with participants
  sendSuccessResponseData(res, "participants", participants, totalCount);
});

module.exports.getEventPrizes = catchAsync(async (req, res) => {
  const event = await Event.findById(req.params.id);

  if (
    event.organisationId?.toString() !== req.user.organisationId?.toString() &&
    event.userId?.toString() !== req.user._id?.toString()
  ) {
    throw new AppError("You do not have permission to access this event.", 404);
  }
  const apiFeatures = new APIFEATURES(
    Prize.find({ eventId: req.params.id }),
    req.query
  )
    .filter()
    .sort()
    .paginate()
    .limitFields();

  const totalCount = await Prize.find({
    eventId: req.params.id,
  }).countDocuments();

  const prizes = await apiFeatures.query;

  sendSuccessResponseData(res, "prizes", prizes, totalCount);
});

module.exports.getAllEventPrizes = catchAsync(async (req, res) => {
  const event = await Event.findById(req.params.id);

  if (
    event.organisationId?.toString() !== req.user.organisationId?.toString() &&
    event.userId?.toString() !== req.user._id?.toString()
  ) {
    throw new AppError("You do not have permission to access this event.", 404);
  }

  const prizes = await Prize.find({ eventId: req.params.id });

  const totalCount = await Prize.find({
    eventId: req.params.id,
  }).countDocuments();

  sendSuccessResponseData(res, "prizes", prizes, totalCount);
});

module.exports.deleteEventParticipants = catchAsync(async (req, res) => {
  const { id: eventId } = req.params;

  if (!eventId) throw new AppError("You need to specify an event Id", 400);

  // Validate event existence
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event does not exist.", 404);
  }

  // Ensure event is inactive and emails have not been sent
  if (event.status !== "inactive") {
    throw new AppError(
      "Participants can only be deleted when the event is inactive.",
      400
    );
  }

  if (event.emailSent) {
    throw new AppError(
      "Participants cannot be deleted as the notification email has already been sent.",
      400
    );
  }

  // Delete the participants
  await Participant.deleteMany({ eventId });
  await Event.updateParticipantsCount(eventId);

  // Set the csv to free
  event.csvUploaded = false;

  await event.save();

  sendSuccessResponseData(res, "participants");
});
