const express = require("express");
const { authenticate, authorize } = require("../controllers/authController");
const transactionController = require("../controllers/transactionController");
const router = express.Router();

router
  .route("/")
  .get(
    authenticate,
    authorize("admin", "user"),
    transactionController.getAllTransaction
  )
  .post(
    authenticate,
    authorize("user"),
    transactionController.createTransaction
  );

router
  .route("/:id")
  .get(
    authenticate,
    authorize("admin", "user"),
    transactionController.getTransaction
  )
  .patch(
    authenticate,
    authorize("admin", "user"),
    transactionController.updateTransaction
  )
  .delete(
    authenticate,
    authorize("admin", "user"),
    transactionController.deleteTransaction
  );

router.post("/webhook", transactionController.webhook);

router.post("/process", transactionController.processTransaction);

module.exports = router;
