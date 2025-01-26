const cron = require("node-cron");
const Organisation = require("../models/organisationModel");
const mongoose = require("mongoose");
const User = require("../models/userModel");

// Helper function to check DB connection
const isDatabaseConnected = () => {
  return mongoose.connection.readyState === 1;
};

const handleOrganisationSubscription = async (organisationId) => {
  try {
    // Fetch the organisation and ensure it exists
    const organisation = await Organisation.findById(organisationId).populate(
      "collaborators"
    );
    if (!organisation) {
      throw new Error(`Organisation with ID ${organisationId} not found`);
    }

    const owner = await User.findById(organisation.owner);
    if (!owner) throw new AppError("Owner not found", 404);

    // Update the subscription status to "active"
    organisation.subscriptionStatus = "active";
    await organisation.save();

    console.log(`Organisation ${organisationId} subscription activated`);

    // Add the organisation back to collaborators' accounts
    const collaborators = organisation.collaborators;
    const updatePromises = collaborators?.map(async (collaborator) => {
      await User.updateOne(
        { _id: collaborator.user._id },
        {
          $addToSet: {
            accounts: {
              organisation: organisationId,
              organisationImage: owner.id,
            },
          }, // Ensures no duplicates
          $set: { organisationId: organisationId },
        }
      );
      console.log(
        `Added organisation ${organisationId} to user ${collaborator.user.email}'s accounts`
      );
    });

    await Promise.all(updatePromises);

    console.log(
      `Organisation ${organisationId} added back to all collaborators' accounts`
    );
  } catch (err) {
    console.error(
      "Error adding organisation back to collaborators' accounts:",
      err
    );
  }
};
// Cron job for subscription renewal checks
cron.schedule("0 0 * * *", async () => {
  console.log("Random cron job running every 1 minute");
  try {
    if (!isDatabaseConnected())
      return console.log(
        "Database not connected. Skipping subscription renewal checks."
      );

    handleOrganisationSubscription("6751a3130e6aec46803b74f1");
  } catch (err) {
    console.error("Error processing subscription renewals:", err);
  }
});
