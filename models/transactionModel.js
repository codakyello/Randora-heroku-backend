const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      required: true,
      default: "pending",
    },
    amount: { type: Number, required: true },
    currency: {
      type: String,
      enum: ["USD", "USDT", "NGN"],
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["crypto", "bank_transfer"],
      required: true,
    },
    // paymentFor: {
    //   type: String,
    //   enum: ["individual", "organisation"],
    //   required: true,
    // },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reference: {
      type: String,
      unique: true,
      default: () =>
        `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    },
  },
  { timestamps: true }
);

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;
