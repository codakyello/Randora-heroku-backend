const Event = require("../models/EventModel");
const Participant = require("../models/ParticipantsModel");
const Organisation = require("../models/OrganisationModel");
const Prize = require("../models/PrizesModel");
const APIFEATURES = require("../utils/apiFeatures");
const AppError = require("../utils/appError");

const { sendSuccessResponseData, catchAsync } = require("../utils/helpers");
const supabase = require("../supabase");
const User = require("../models/userModel");

module.exports.getAllPrizes = catchAsync(async (req, res) => {
  const apiFeatures = APIFEATURES(Prize, req.query)
    .filter()
    .sort()
    .page()
    .paginate();

  const totalCount = await Prize.countDocuments();

  const prizes = await apiFeatures.query;

  sendSuccessResponseData(res, "prizes", prizes, totalCount);
});

module.exports.getPrize = catchAsync(async (req, res) => {
  const prize = await Prize.findById(req.params.id);

  if (!prize)
    throw new AppError("Prize with the given ID does not exist.", 404);

  sendSuccessResponseData(res, "prize", prize);
});

// Drawn handler
module.exports.assignPrize = catchAsync(async (req, res) => {
  const prizeId = req.params.id;
  const { participantId } = req.body;

  // Find the prize
  const prize = await Prize.findById(prizeId);
  if (!prize) {
    throw new AppError("Prize not found", 400); // Throw an error if the prize doesn't exist
  }

  const eventId = prize.eventId;

  const event = await Event.findById(eventId);

  if (!event) throw new AppError("Event not found", 400);

  // Check if the prize is still available
  if (prize.quantity <= 0) {
    throw new AppError("Prize is out of stock", 400); // Ensure there are available prizes
  }
  await Prize.findByIdAndUpdate(
    prizeId,
    { $inc: { quantity: -1 } },
    { new: true }
  );

  if (event.remainingPrize <= 0) {
    throw new AppError("No prizes remaining", 400); // Prevent updating if no remaining prizes
  }

  // Reduce the remaining price on the event
  // This one is perfect it reduces the quantity everytime
  await Event.findByIdAndUpdate(eventId, {
    $inc: { remainingPrize: -1 },
    status: "active",
  });

  // update participant with prizeId and set isWinner true
  const participant = await Participant.findByIdAndUpdate(
    participantId,
    { prize: prizeId, isWinner: true },
    { new: true }
  );

  if (!participant) {
    throw new AppError("Participant not found", 404);
  }

  sendSuccessResponseData(res, "Participant updated successfully", participant);
});

module.exports.createPrizes = catchAsync(async (req, res) => {
  const Replicate = require("replicate");
  const replicate = new Replicate();

  const prizes = req.body;
  const eventId = prizes.at(0).eventId;

  const firstPrize = prizes.at(0);

  let subscriptionStatus;

  if (firstPrize.hasOwnProperty("organisationId")) {
    const organisation = await Organisation.findById(firstPrize.organisationId);
    subscriptionStatus = organisation?.subscriptionStatus; // Handle null values safely
  } else {
    const user = await User.findById(firstPrize.userId);
    subscriptionStatus = user?.isSubscribed; // Handle null values safely
  }

  // Validate event existence
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event does not exist.", 404);
  }

  if (event.status === "completed") {
    throw new AppError(
      "Prizes can only be created when an event is inactive",
      400
    );
  }

  // Check for duplicate prize names within the event
  const existingPrizes = await Prize.find({ eventId });
  const existingPrizeNames = existingPrizes.map((prize) =>
    prize.name.toLowerCase()
  );

  const duplicateNames = prizes
    .map((prize) => prize.name.toLowerCase())
    .filter((name) => existingPrizeNames.includes(name));

  if (duplicateNames.length > 0) {
    throw new AppError(
      `${duplicateNames.join(
        ", "
      )} already exist. Consider updating the quantity instead.`,
      400
    );
  }

  const newPrizes = await Promise.all(
    prizes.map(async (prize) => {
      let existingPrizeImage;
      try {
        existingPrizeImage = await Prize.findOne({
          $and: [
            prize.hasOwnProperty("organisationId")
              ? {
                  organisationId: prize.organisationId,
                  name: { $regex: new RegExp(`^${prize.name}$`, "i") }, // Case-insensitive match
                }
              : {
                  userId: prize.userId,
                  name: { $regex: new RegExp(`^${prize.name}$`, "i") }, // Case-insensitive match
                },
          ],
        });
      } catch (err) {
        throw new AppError("Invalid Prize name", 400);
      }

      if (existingPrizeImage) {
        return { ...prize, image: existingPrizeImage.image };
      }

      // This is a paid feature
      if (subscriptionStatus || subscriptionStatus === "active") {
        try {
          // const response = await openai.images.generate({
          //   model: "dall-e-3",
          //   prompt: `Generate a realistic image of a ${prize.name} with a premium and real life design. Prioritize on making the image look as real as possible. Generate images that people are used to seeing in their every day life`,
          //   size: "1024x1024",
          //   quality: "standard",
          //   n: 1,
          // });

          const input = {
            steps: 25,
            width: 1024,
            height: 1024,
            prompt: `Generate a realistic image of a ${prize.name} with a premium and real life design. Prioritize on making the image look as real as possible. Show nothing else other than the ${prize.name}`,
            guidance: 3,
            interval: 2,
            aspect_ratio: "1:1",
            output_format: "webp",
            output_quality: 80,
            safety_tolerance: 2,
            prompt_upsampling: false,
          };

          // Generate image using Replicate
          const output = await replicate.run("black-forest-labs/flux-pro", {
            input,
          });

          // Fetch the generated image
          const response = await fetch(output);
          if (!response.ok) {
            throw new Error(
              `Failed to fetch the image: ${response.statusText}`
            );
          }

          const arrayBuffer = await response.arrayBuffer();
          const imageBuffer = Buffer.from(arrayBuffer);

          const fileName = `${prize.name}-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)}.png`;

          // Upload to Supabase
          const { data, error } = await supabase.storage
            .from("prize-images")
            .upload(`public/${fileName}`, imageBuffer, {
              contentType: "image/png",
            });

          if (error) {
            console.error("Supabase upload error:", error);
            throw new Error("Failed to upload image to Supabase");
          }

          const imageUrlSupabase = `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/${data.fullPath}`;

          return { ...prize, image: imageUrlSupabase };
        } catch (error) {
          console.error("Error generating or saving prize image:", error);
          return prize;
        }
      } else {
        return { ...prize, image: "" };
      }
    })
  );

  // we also want to generate prize images using AI.

  const createdPrizes = await Prize.insertMany(newPrizes);

  // Update event prize counts
  await Promise.all([
    Event.updatePrizeCount(eventId),
    Event.updateRemainingPrizeCount(eventId),
  ]);

  sendSuccessResponseData(res, "prizes", createdPrizes);
});

module.exports.updatePrize = catchAsync(async (req, res) => {
  const { quantity } = req.body;

  const prize = await Prize.findById(req.params.id);

  if (!prize) {
    throw new AppError("Prize not found.", 404);
  }

  const event = await Event.findById(prize.eventId);

  const existingPrize = await Prize.findOne({
    name: req.body.name,
    eventId: prize.eventId,
  });

  console.log(prize);

  console.log(existingPrize);

  if (existingPrize && !existingPrize._id.equals(prize._id)) {
    throw new AppError("A Prize with this name already exists", 400);
  }

  if (event.status === "inactive") {
    for (const key in req.body) {
      prize[key] = req.body[key];
    }
    await prize.save();

    if (quantity) {
      await Promise.all([
        Event.updatePrizeCount(prize.eventId),
        Event.updateRemainingPrizeCount(prize.eventId),
      ]);
    }

    sendSuccessResponseData(res, "prize", prize);
  } else {
    throw new AppError(
      "Prizes can only be updated when the event is inactive.",
      400
    );
  }
});

module.exports.deletePrize = catchAsync(async (req, res) => {
  // Fetch the prize
  const prize = await Prize.findById(req.params.id);
  if (!prize) {
    throw new AppError("Prize not found.", 404);
  }

  // Fetch the related event
  const event = await Event.findById(prize.eventId);
  if (!event) {
    throw new AppError("Event does not exist.", 404);
  }

  // Ensure the event is inactive
  if (event.status !== "inactive") {
    throw new AppError(
      "Prizes can only be deleted when the event is inactive.",
      400
    );
  }

  // Delete the prize after all validations
  await prize.remove();

  // Update the event counts
  await Promise.all([
    Event.updatePrizeCount(prize.eventId),
    Event.updateRemainingPrizeCount(prize.eventId),
  ]);

  // Send response
  sendSuccessResponseData(res, "Prize deleted successfully.");
});
