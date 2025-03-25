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

  try {
    // Find the transaction
    const transaction = await Transaction.findOne({ reference });

    if (!transaction) {
      console.error(`Transaction with reference ${reference} not found`);
      return res.status(200).json({ message: "Transaction not found" }); // Always return 200
    }

    if (eventType === "payment.session.succeded") {
      transaction.status = "success";

      // Get the transaction owner
      const owner = await User.findById(transaction.userId);

      if (!owner) {
        console.error(`User with ID ${transaction.userId} not found`);
        return res.status(200).json({ message: "User not found" }); // Always return 200
      }

      const currentDate = new Date();
      owner.subscriptionStatus = "active";
      owner.subscriptionExpiryDate = new Date(
        currentDate.setMonth(currentDate.getMonth() + 1)
      );

      if (owner.accountType === "organisation") {
        const organisation = await Organisation.findById(
          owner.organisationId
        ).populate("collaborators");
        organisation.subscriptionExpiryDate = new Date(
          currentDate.setMonth(currentDate.getMonth() + 1)
        );

        if (!organisation) {
          console.error(
            `Organisation with ID ${owner.organisationId} not found`
          );
          return res.status(200).json({ message: "Organisation not found" });
        }

        organisation.subscriptionStatus = "active";
        await organisation.save();

        // Update collaborators' accounts
        const updatePromises = organisation.collaborators?.map(
          async (collaborator) => {
            await User.updateOne(
              { _id: collaborator.user._id },
              {
                $addToSet: {
                  accounts: {
                    organisation: owner.organisationId,
                    organisationImage: owner.id,
                  },
                },
                $set: { organisationId: owner.organisationId },
              }
            );
          }
        );

        await Promise.all(updatePromises);
      }

      await owner.save();
    } else if (eventType === "payment.session.failed") {
      transaction.status = "failed";
      await transaction.save();
    }

    return res.status(200).json({ message: "Webhook processed" }); // Always return 200
  } catch (error) {
    console.error("Webhook processing error:", error);
    return res.status(200).json({ message: "Webhook error logged" }); // Still return 200
  }
});

module.exports.processTransaction = catchAsync(async (req, res) => {
  const { reference, eventType } = req.body;

  console.log(reference, eventType);

  // Find the transaction
  const transaction = await Transaction.findOne({ reference });

  if (!transaction) {
    throw new AppError("Transaction not found", 404);
  }

  if (eventType === "payment.session.succeded") {
    transaction.status = "success";

    // Get the transaction owner
    const owner = await User.findById(transaction.userId);

    if (!owner) {
      console.error(`User with ID ${transaction.userId} not found`);
      throw new AppError("User not found", 404);
    }

    const currentDate = new Date();
    owner.subscriptionStatus = "active";
    owner.subscriptionExpiryDate = new Date(
      currentDate.setMonth(currentDate.getMonth() + 1)
    );

    if (owner.accountType === "organisation") {
      const organisation = await Organisation.findById(
        owner.organisationId
      ).populate("collaborators");
      organisation.subscriptionExpiryDate = new Date(
        currentDate.setMonth(currentDate.getMonth() + 1)
      );

      if (!organisation) {
        throw new AppError("Organisation not found", 404);
      }

      organisation.subscriptionStatus = "active";
      await organisation.save();

      // Update collaborators' accounts
      const updatePromises = organisation.collaborators?.map(
        async (collaborator) => {
          await User.updateOne(
            { _id: collaborator.user._id },
            {
              $addToSet: {
                accounts: {
                  organisation: owner.organisationId,
                  organisationImage: owner.id,
                },
              },
              $set: { organisationId: owner.organisationId },
            }
          );
        }
      );

      await Promise.all(updatePromises);

      return res
        .status(200)
        .json({ message: "Payment successfully processed" });
    }

    await owner.save();
  } else if (eventType === "payment.session.failed") {
    transaction.status = "failed";

    return res.status(400).json({ message: "Payment could not be processed" });
  }

  await transaction.save();

  // return res.status(200).json({ message: "Webhook processed" }); // Always return 200
});
