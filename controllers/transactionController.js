const Transaction = require("../models/transactionModel");
const APIFEATURES = require("../utils/apiFeatures");
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
