const cron = require("node-cron");
const Organisation = require("../models/organisationModel");
const User = require("../models/userModel");
const mongoose = require("mongoose");
const Email = require("../utils/email");

// Cleanup function to remove organisation ID from users in expired organisation
const removeOrganisationFromUsers = async (organisationId) => {
  // update only individual accounts
  try {
    // For people that are on the account set organisation Id to ""
    // Then remove the organisation Id from the user's list of accounts
    await User.updateMany(
      { "accounts.organisation": organisationId },
      { $pull: { accounts: { organisation: organisationId } } }
    );

    await User.updateMany(
      { organisationId, accountType: "individual" },
      { $set: { organisationId: undefined } }
    );

    // send email to owner
    const organisation = await Organisation.findById(organisationId);

    organisation.subscriptionStatus = "expired";
    await organisation.save();
    const owner = await User.findById(organisation.owner);
    if (owner) {
      await new Email(owner).sendOrgSubscriptionExpiry(organisation.name);
    }
  } catch (err) {
    console.error("Error removing organisationId from users:", err);
  }
};

// Helper function to check DB connection
const isDatabaseConnected = () => {
  return mongoose.connection.readyState === 1;
};

// Cron job to run every day and check for expired subscriptions
cron.schedule("0 0 * * *", async () => {
  // Runs every day at midnight
  console.log("Random cron job running every 5 minutes");
  try {
    if (!isDatabaseConnected()) {
      console.log("Database not connected. Skipping subscription cleanup.");
      return;
    }

    const expiredOrganisations = await Organisation.find({
      subscriptionExpiryDate: { $lt: new Date() }, // Expired subscriptions
      subscriptionStatus: "active",
    });

    const expiredUsers = await User.find({
      subscriptionExpiryDate: { $lt: new Date() }, // Expired subscriptions
      subscriptionStatus: "active",
    });

    expiredUsers.forEach(async (user) => {
      user.subscriptionStatus = "expired";
      await user.save();
      await new Email(user).sendUserSubscriptionExpiry();
    });

    expiredOrganisations.forEach(async (organisation) => {
      // Remove the organisationId from all users linked to the expired organisation
      await removeOrganisationFromUsers(organisation._id);
    });
  } catch (err) {
    console.error("Error checking for expired subscriptions:", err);
  }
});
