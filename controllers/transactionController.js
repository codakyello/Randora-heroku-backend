const Organisation = require("../models/organisationModel");
const Transaction = require("../models/transactionModel");
const User = require("../models/userModel");
const APIFEATURES = require("../utils/apiFeatures");
const AppError = require("../utils/appError");
const { catchAsync, sendSuccessResponseData } = require("../utils/helpers");

module.exports.getAllTransaction = catchAsync(async (req, res) => {
  const apiFeatures = new APIFEATURES(Transaction, req.query)
    .filter()
    .sort()
    .paginate()
    .limitFields();

  const totalCount = await Transaction.countDocuments();

  const transactions = await apiFeatures.query;

  console.log(transactions, "This is transactions");

  sendSuccessResponseData(res, "transactions", transactions, totalCount);
});

module.exports.getTransaction = catchAsync(async (req, res) => {
  const { id } = req.params;

  const transaction = await Transaction.findById(id);

  if (!transaction)
    throw new AppError("Transaction with the given ID does not exist.", 404);
});

module.exports.createTransaction = catchAsync(async (req, res) => {
  const newTransaction = await Transaction.create({
    ...req.body,
    // paymentFor: req.user.acccountType,
  });

  sendSuccessResponseData(res, "transaction", newTransaction);
});

module.exports.updateTransaction = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updateFields = Object.keys(req.body); // Get keys of request body

  // Allow only the 'status' field
  if (updateFields.length !== 1 || updateFields[0] !== "status") {
    return res.status(400).json({ message: "Only 'status' can be updated" });
  }
  const { status } = req.body;

  // Update the transaction's status
  const updatedTransaction = await Transaction.findByIdAndUpdate(
    id,
    { status },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updatedTransaction) throw new AppError("Transaction not found", 404);

  sendSuccessResponseData(res, "transaction", updatedTransaction);
});

module.exports.deleteTransaction = catchAsync((req, res) => {});

module.exports.webhook = catchAsync(async (req, res) => {
  console.log("inside webhook");
  const { reference, eventType } = req.body;

  console.log(reference, eventType);

  // look for the transactionId in the transaction model

  const transaction = await Transaction.findOne({ reference });

  // check if the payment was successful

  if (eventType === "payment.session.succeded") {
    transaction.status = "success";

    // get the owner of the transaction

    const owner = await User.findById(transaction.userId);

    console.log(owner);

    if (!owner) throw new AppError("User not found", 404);

    if (owner.accountType === "organisation") {
      // Renew organisation account
      const organisation = await Organisation.findById(
        owner.organisationId
      ).populate("collaborators");

      if (!organisation) {
        throw new Error(
          `Organisation with ID ${owner.organisationId} not found`
        );
      }

      //  const owner = await User.findById(organisation.owner);
      //  if (!owner) throw new AppError("Owner not found", 404);

      // Update the subscription status to "active"
      organisation.subscriptionStatus = "active";
      await organisation.save();

      console.log(
        `Organisation ${owner.organisationId} subscription activated`
      );

      // Add the organisation back to collaborators' accounts
      const collaborators = organisation.collaborators;
      console.log(collaborators);
      const updatePromises = collaborators?.map(async (collaborator) => {
        await User.updateOne(
          { _id: collaborator.user._id },
          {
            $addToSet: {
              accounts: {
                organisation: owner.organisationId,
                organisationImage: owner.id,
              },
            }, // Ensures no duplicates
            $set: { organisationId: owner.organisationId },
          }
        );
        console.log(
          `Added organisation ${owner.organisationId} to user ${collaborator.user.email}'s accounts`
        );
      });

      await Promise.all(updatePromises);
    } else {
      owner.subscriptionStatus = "active";
      await owner.save();
      // Renew individual account
    }
  } else if (eventType === "payment.session.failed") {
  }

  return res.status(200).json();
});

module.exports.webhook = catchAsync(async (req, res, next) => {
  console.log("Inside webhook");
  const { reference, eventType } = req.body;

  console.log(`Reference: ${reference}, Event Type: ${eventType}`);

  // Look for the transactionId in the transaction model
  const transaction = await Transaction.findOne({ reference });

  if (!transaction) {
    console.error(`Transaction with reference ${reference} not found.`);
    throw new AppError("Transaction not found", 404);
  }

  // Check if the payment was successful
  if (eventType === "payment.session.succeeded") {
    transaction.status = "success";
    await transaction.save();

    // Get the owner of the transaction
    const owner = await User.findById(transaction.userId);

    if (!owner) {
      console.error("User not found for transaction:", reference);
      throw new AppError("User not found", 404);
    }

    if (owner.accountType === "organisation") {
      // Renew organisation account
      const organisation = await Organisation.findById(
        owner.organisationId
      ).populate("collaborators");

      if (!organisation) {
        console.error(`Organisation with ID ${owner.organisationId} not found`);
        throw new AppError("Organisation not found", 404);
      }

      // Update the subscription status to "active"
      organisation.subscriptionStatus = "active";
      const currentDate = new Date();
      organisation.subscriptionExpiryDate = new Date(
        currentDate.setMonth(currentDate.getMonth() + 1)
      );

      await organisation.save();

      // Add the organisation back to collaborators' accounts
      const collaborators = organisation.collaborators || [];
      console.log("Collaborators:", collaborators);

      const updatePromises = collaborators.map(async (collaborator) => {
        await User.updateOne(
          { _id: collaborator.user._id },
          {
            $addToSet: {
              accounts: {
                organisation: owner.organisationId,
                organisationImage: owner.id,
              },
            }, // Ensures no duplicates
            $set: { organisationId: owner.organisationId },
          }
        );
        console.log(
          `Added organisation ${owner.organisationId} to ${collaborator.user.email}'s accounts`
        );
      });

      await Promise.all(updatePromises);
    } else {
      // Renew individual account
      owner.subscriptionStatus = "active";
      const currentDate = new Date();
      owner.subscriptionExpiryDate = new Date(
        currentDate.setMonth(currentDate.getMonth() + 1)
      );

      await owner.save();
    }
  } else if (eventType === "payment.session.failed") {
    transaction.status = "failed";
    await transaction.save();
    console.log(`Transaction ${reference} failed`);
  } else {
    console.warn(`Unhandled event type: ${eventType}`);
  }

  return res.status(200).json({ status: "success" });
});
