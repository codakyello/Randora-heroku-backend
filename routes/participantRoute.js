const express = require("express");
const participantController = require("../controllers/participantController");
const { authenticate, authorize } = require("../controllers/authController");
const router = express.Router();
const multer = require("multer");

const storage = multer.memoryStorage();

// Set up file filter to accept only CSV files
const fileFilter = (_req, file, cb) => {
  if (file.mimetype === "text/csv") {
    cb(null, true); // Accept the file
  } else {
    cb(new Error("Only CSV files are allowed!"), false); // Reject the file
  }
};

// Configure Multer
const upload = multer({
  storage,
  fileFilter,
});

router.post(
  "/upload",
  upload.single("file"),
  authenticate,
  authorize("user"),
  participantController.uploadParticipants
);

router
  .route("/")
  .get(
    authenticate,
    authorize("admin"),
    participantController.getAllParticipants
  )
  .post(
    authenticate,
    authorize("user"),
    participantController.createParticipant
  );

router
  .route("/:id")
  .patch(
    authenticate,
    authorize("user"),
    participantController.updateParticipant
  )
  .delete(
    authenticate,
    authorize("user"),
    participantController.deleteParticipant
  );
module.exports = router;
