const express = require("express");
const eventController = require("../controllers/eventController");
const { authenticate, authorize } = require("../controllers/authController");
const router = express.Router();

router
  .route("/")
  .get(authenticate, authorize("admin"), eventController.getAllEvents)
  .post(authenticate, authorize("user"), eventController.createEvent);

router
  .route("/:id")
  .get(authenticate, authorize("user", "admin"), eventController.getEvent)
  .patch(authenticate, authorize("user", "admin"), eventController.updateEvent)
  .delete(
    authenticate,
    authorize("user", "admin"),
    eventController.deleteEvent
  );

router
  .route("/:id/participants")
  .get(
    authenticate,
    authorize("user", "admin"),
    eventController.getEventParticipants
  )
  .delete(
    authenticate,
    authorize("user", "admin"),
    eventController.deleteEventParticipants
  );

router
  .route("/:id/all-participants")
  .get(
    authenticate,
    authorize("user", "admin"),
    eventController.getEventAllParticipants
  );

router
  .route("/:id/winners")
  .get(
    authenticate,
    authorize("user", "admin"),
    eventController.getEventWinners
  );
router
  .route("/:id/prizes")
  .get(
    authenticate,
    authorize("user", "admin"),
    eventController.getEventPrizes
  );

router
  .route("/:id/all-prizes")
  .get(
    authenticate,
    authorize("user", "admin"),
    eventController.getAllEventPrizes
  );
module.exports = router;
