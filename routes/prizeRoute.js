const express = require("express");
const router = express.Router();
const prizeController = require("../controllers/prizeController");
const { authenticate, authorize } = require("../controllers/authController");

router
  .route("/")
  .get(authenticate, authorize("admin"), prizeController.getAllPrizes)
  .post(authenticate, authorize("admin", "user"), prizeController.createPrizes);

router
  .route("/:id")
  .get(authenticate, authorize("admin", "user"), prizeController.getPrize)
  .patch(authenticate, authorize("admin", "user"), prizeController.updatePrize)
  .delete(
    authenticate,
    authorize("admin", "user"),
    prizeController.deletePrize
  );

router
  .route("/:id/assign-price")
  .patch(authenticate, authorize("admin", "user"), prizeController.assignPrize);

module.exports = router;
