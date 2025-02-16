const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const globalErrorHandler = require("./controllers/errorController");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const helmet = require("helmet");
const hpp = require("hpp");
const AppError = require("./utils/appError");

const userRoutes = require("./routes/userRoutes");
const participantRoutes = require("./routes/participantRoute");
const eventRoutes = require("./routes/eventRoutes");
const prizeRoutes = require("./routes/prizeRoute");
const organisationRoutes = require("./routes/organisationRoutes");
const transactionRoutes = require("./routes/transactionRoutes");

const app = express();

//Cron Jobs
// require("./cronJobs/renewSubscription");
require("./cronJobs/subscriptionExpiryCleanup");
require("./cronJobs/subscriptionRemider");

dotenv.config({ path: "./config.env" });

app.use(cors());

app.use(helmet());

app.use(cookieParser());

app.use(express.json());

app.use(bodyParser.json({ limit: "10kb" }));

app.use(mongoSanitize());

app.use(
  hpp({
    whitelist: [],
  })
);

app.use(express.static(`${__dirname}/public`));

// Routes
app.use("/api/v1/users", userRoutes);

app.use("/api/v1/participants", participantRoutes);

app.use("/api/v1/events", eventRoutes);

app.use("/api/v1/prizes", prizeRoutes);

app.use("/api/v1/organisations", organisationRoutes);

app.use("/api/v1/transactions", transactionRoutes);

app.get("/", (_req, res) => {
  res.send("<h1>Deployment Check</h1>");
});

app.use("*", (req, _res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
