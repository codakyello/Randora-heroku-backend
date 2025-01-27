const cron = require("node-cron");
const Organisation = require("../models/organisationModel");
const User = require("../models/userModel");
const Email = require("../utils/email");
const mongoose = require("mongoose");

// Reminder 7 days before subscription expiry

// change to every midnight
cron.schedule("0 6 * * *", async () => {
  // Runs every day at midnight
  try {
    // Check if mongoose is connected before proceeding
    if (mongoose.connection.readyState !== 1) {
      console.log(
        "Database connection not ready. Skipping subscription check."
      );
      return;
    }

    const organisations = await Organisation.find({
      subscriptionExpiryDate: {
        $lt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      },
      subscriptionStatus: "active",
    }).exec();

    const users = await User.find({
      subscriptionExpiryDate: {
        $lt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      },
      subscriptionStatus: "active",
    }).exec();

    users.forEach(async (user) => {
      const daysRemaining = Math.ceil(
        (user.subscriptionExpiryDate - new Date()) / (1000 * 60 * 60 * 24)
      );
      const email = new Email(user);
      await email.sendSubscriptionReminderU(daysRemaining);
    });

    organisations.forEach(async (organisation) => {
      const owner = await User.findById(organisation.owner);
      if (owner) {
        // Calculate the number of days remaining
        const daysRemaining = Math.ceil(
          (organisation.subscriptionExpiryDate - new Date()) /
            (1000 * 60 * 60 * 24)
        );

        // Send the reminder email with the exact number of days remaining
        const email = new Email(owner);
        console.log(owner.email);
        await email.sendSubscriptionReminder(organisation.name, daysRemaining);
      }
    });
  } catch (error) {
    console.error("Error sending subscription reminders:", error);
    // Log more detailed error information
    if (error.name === "MongooseError") {
      console.error("Database connection error:", error.message);
    }
  }
});
