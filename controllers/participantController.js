const { catchAsync, sendSuccessResponseData } = require("../utils/helpers");
const csv = require("csv-parser");

const Participant = require("../models/ParticipantsModel");
const Event = require("../models/EventModel");
const AppError = require("../utils/appError");
const { ROW_LIMIT } = require("../utils/const");
const Organisation = require("../models/organisationModel");

module.exports.getAllParticipants = catchAsync(async (req, res) => {
  res.status(500).json({
    status: "fail",
    message: "This route is not yet implemented",
  });
});

module.exports.getParticipant = catchAsync(async (req, res) => {
  res.status(500).json({
    status: "fail",
    message: "This route is not yet implemented",
  });
});

module.exports.uploadParticipants = catchAsync(async (req, res) => {
  const csvBuffer = req.file?.buffer; // Access the uploaded CSV file as a buffer
  const eventId = req.body.eventId;

  // check for the status of the account
  const user = req.user;

  let subscriptionStatus = user.subscriptionStatus;

  if (user.acccountType === "organisation") {
    const organisation = await Organisation.findById(user.organisationId);
    subscriptionStatus = organisation.subscriptionStatus;
  }

  if (subscriptionStatus !== "active")
    throw new AppError("Please upgrade your plan to upload participants", 400);

  try {
    if (!csvBuffer) throw new AppError("No CSV File uploaded", 400);

    // Check if the event is inactive
    const event = await Event.findById(eventId);

    if (!event) throw new AppError("No Event with this ID exists", 404);

    if (event.status === "completed") {
      throw new AppError(
        `You cannot upload CSV for an event that is ${event.status}`,
        400
      );
    }

    if (event.csvUploaded) {
      throw new AppError(
        "Participants have already been uploaded for this event.",
        400
      );
    }

    // Get existing participants for the event
    const existingParticipants = await Participant.find({ eventId });

    // Parse CSV from buffer
    const participants = await new Promise((resolve, reject) => {
      const rows = [];
      const stream = require("stream");
      const csvStream = new stream.PassThrough();
      csvStream.end(csvBuffer);

      csvStream
        .pipe(
          csv({
            mapHeaders: ({ header }) =>
              header
                .trim() // Remove leading/trailing spaces
                .replace(/\s+/g, "") // Remove all spaces within the string
                .toLowerCase(), // Convert to lowercase
          })
        )
        .on("data", (row) => rows.push(row))
        .on("end", () => resolve(rows))
        .on("error", () =>
          reject(new AppError("Error reading the CSV file.", 500))
        );
    });

    if (participants.length > ROW_LIMIT) {
      throw new AppError(`The uploaded file exceeds the ${ROW_LIMIT} limit.`);
    }

    if (participants.length === 0) {
      throw new AppError("CSV file is empty.", 400);
    }

    const hasTicketNumber = participants[0].hasOwnProperty("ticketnumber");
    const hasEmail = participants[0].hasOwnProperty("email");
    const hasName = participants[0].hasOwnProperty("name");

    if (!hasTicketNumber) {
      throw new AppError(
        "You need to provide ticketNumbers. If you don't have them, use our built-in tool to generate unique ticket Numbers",
        400
      );
    }

    // Process participants
    const processedParticipants = participants.map((participant, index) => {
      const email = participant.email;
      const name = participant.name;
      // const ticketNumber = Number(participant.ticketnumber);
      const ticketNumber = participant.ticketnumber;

      const rowNumber = index + 2;

      if (!ticketNumber) {
        throw new AppError(
          `Ticket Number ${ticketNumber} at row ${rowNumber} is missing`,
          400
        );
      }

      if (hasEmail && !email) {
        throw new AppError(`Email at row ${rowNumber} is missing`, 400);
      }

      if (hasName && !name) {
        throw new AppError(`Name at row ${rowNumber} is missing`, 400);
      }

      // console.log("the participant", participant);

      existingParticipants.forEach((participant) => {
        if (participant.ticketNumber === ticketNumber) {
          throw new AppError(
            `The ticket number: ${ticketNumber} at row number ${rowNumber} already exists for this event`,
            400
          );
        }

        if (participant.email?.toLowerCase() === email) {
          throw new AppError(
            `The participant with email ${email} at row number ${rowNumber} already exists for this event`,
            400
          );
        }
      });

      if (hasEmail) {
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        if (!emailRegex.test(email)) {
          throw new AppError(`Invalid email address: ${email}`, 400);
        }
      }

      for (let i = index + 1; i < participants.length; i++) {
        if (hasEmail && participants[i].email.toLowerCase() === email) {
          throw new AppError(
            `Duplicate email address: ${email} at row ${rowNumber} and at row ${
              i + 2
            }.`,
            400
          );
        }

        if (
          hasTicketNumber &&
          participants[i].ticketnumber === ticketNumber
          // Number(participants[i].ticketnumber) === ticketNumber
        ) {
          throw new AppError(
            `Duplicate ticket number: Ticket Number: ${ticketNumber}, at row ${rowNumber} and at row ${
              i + 2
            }.`,
            400
          );
        }
      }

      return {
        name,
        email,
        ticketNumber,
        eventId,
      };
    });

    try {
      await Participant.insertMany(processedParticipants);

      event.csvUploaded = true;
      await event.save();
      await Event.updateParticipantsCount(eventId);

      sendSuccessResponseData(res, "participants", processedParticipants);
    } catch (err) {
      await Participant.deleteMany({ eventId });
      throw err;
    }
  } catch (err) {
    throw err;
  }
});

//Create participants manually
module.exports.createParticipant = catchAsync(async (req, res) => {
  const { ticketNumber, eventId } = req.body;

  console.log(req.body);
  const event = await Event.findById(eventId);

  if (!event) throw new AppError("The Event with this ID does not exist", 404);

  if (event.status === "completed")
    throw new AppError(
      `You cannot create more participants for an event that is ${event.status} `,
      400
    );

  if (!ticketNumber) {
    throw new AppError("Ticket Number is required", 400);
  }

  // Check for duplicate ticket number
  const existingTicket = await Participant.findOne({
    eventId,
    ticketNumber,
  });

  if (existingTicket) {
    throw new AppError(
      `A participant with this ticketNumber "${ticketNumber}" already exists for this event.`,
      400
    );
  }

  if (req.body.email) {
    const existingEmail = await Participant.findOne({
      eventId,
      email: req.body.email,
    });

    if (existingEmail) {
      throw new AppError(
        `A participant with this email "${req.body.email}" already exists for this event.`,
        400
      );
    }
  }

  // Create a new participant
  const newParticipant = await Participant.create(req.body);
  await Event.updateParticipantsCount(eventId);

  sendSuccessResponseData(res, "participant", newParticipant);
});

module.exports.updateParticipant = catchAsync(async (req, res) => {
  const { ticketNumber, isWinner, email } = req.body;

  const participant = await Participant.findById(req.params.id);
  if (!participant) {
    throw new AppError("No participant found with that ID.", 404);
  }

  const eventId = participant.eventId;

  // Validate event existence
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event does not exist.", 404);
  }

  // Handle `isWinner` updates
  if (isWinner) {
    if (event.status !== "active") {
      throw new AppError(
        "Winner status can only be updated when the event is ongoing.",
        400
      );
    }

    participant.isWinner = isWinner;
    await participant.save();

    return sendSuccessResponseData(res, "participant", participant);
  }

  // Handle other updates (e.g., ticketNumber)
  if (event.status !== "inactive") {
    throw new AppError(
      "Participants can only be updated when the event is inactive.",
      400
    );
  }

  if (event.emailSent) {
    throw new AppError(
      "Updates are not allowed as the notification email has already been sent.",
      400
    );
  }

  // Ensure unique ticketNumber if being updated
  if (ticketNumber && ticketNumber !== participant.ticketNumber) {
    const existingParticipant = await Participant.findOne({
      eventId,
      ticketNumber,
    });

    if (existingParticipant) {
      throw new AppError(
        `The ticket number "${ticketNumber}" already exists for this event.`,
        400
      );
    }
  }

  if (email && email !== participant.email) {
    const existingParticipant = await Participant.findOne({
      eventId,
      email,
    });

    if (existingParticipant) {
      throw new AppError(
        `A participant with this email "${email}" already exists for this event.`,
        400
      );
    }
  }

  Object.keys(req.body).forEach((key) => {
    participant[key] = req.body[key];
  });

  // Save updated participant
  await participant.save();

  sendSuccessResponseData(res, "participant", participant);
});

module.exports.deleteParticipant = catchAsync(async (req, res) => {
  const participant = await Participant.findById(req.params.id);

  if (!participant) {
    throw new AppError("No participant found with that ID.", 404);
  }
  const eventId = participant.eventId;

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

  // Delete the participant
  await participant.deleteOne();

  const participants = await Participant.find({ eventId });

  await Event.updateParticipantsCount(eventId);

  if (!participants.length) {
    event.csvUploaded = false;

    await event.save();
  }
  sendSuccessResponseData(res);
});
