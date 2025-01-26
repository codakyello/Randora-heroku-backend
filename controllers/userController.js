const Event = require("../models/EventModel");
const Organisation = require("../models/organisationModel");
const User = require("../models/userModel");
const APIFEATURES = require("../utils/apiFeatures");
const AppError = require("../utils/appError");
const { catchAsync, filterObj } = require("../utils/helpers");
const { sendSuccessResponseData } = require("../utils/helpers");

module.exports.getAllUser = catchAsync(async function (req, res) {
  const apiFeatures = new APIFEATURES(User, req.query)
    .filter()
    .limitFields()
    .sort()
    .paginate();

  const users = await apiFeatures.query;

  const totalUsers = await User.countDocuments({ active: true });

  sendSuccessResponseData(res, "users", users, totalUsers);
});

module.exports.updateMe = catchAsync(async (req, res, _next) => {
  // 1) Throw error if user posts password data
  if (req.body.password || req.body.passwordConfirm) {
    throw new AppError(
      "This route is not for password updates. Please use /update-my-password",
      400
    );
  }

  // 2) We don't want to update sensitive info like email and name
  const filteredBody = filterObj(req.body, "logo", "image", "userName");

  // 3) Handle setting organisationId logic
  if (req.body.organisationId) {
    if (req.body.organisationId !== "undefined") {
      // Check if the user still belongs to the organisation
      const organisation = await Organisation.findById(req.body.organisationId);

      if (!organisation) {
        throw new AppError("Organisation not found", 404); // Handle invalid organisation ID
      }

      // Check if the user is in the collaborators array
      const isCollaborator = organisation.collaborators.some(
        (collaborator) =>
          collaborator.user._id.toString() === req.user._id.toString()
      );

      if (!isCollaborator) {
        throw new AppError("You are no longer part of this organisation", 403);
      }

      // If valid, set the organisationId in the filtered body
      filteredBody.organisationId = req.body.organisationId;
    } else {
      // Remove the field if it's "undefined"
      filteredBody.organisationId = undefined;
    }
  }

  // 4) Update the user
  const updatedUser = await User.findByIdAndUpdate(req.user._id, filteredBody, {
    new: true,
    runValidators: true,
  });

  // 5) Send success response
  sendSuccessResponseData(res, "user", updatedUser);
});

module.exports.deleteMe = catchAsync(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user.id, { active: false });

  if (!user) throw new AppError("User not found", 404);

  res.status(204).json({});
});

module.exports.getUser = catchAsync(async function (req, res) {
  const user = await User.findById(req.params.id);

  console.log(user);
  if (!user) throw new AppError("No user was found", 404);

  sendSuccessResponseData(res, "user", user);
});

module.exports.getUserByEmail = catchAsync(async function (req, res) {
  const email = req.query.email;
  const user = await User.findOne({ email });
  if (!user) throw new AppError("No user was found", 404);

  sendSuccessResponseData(res, "user", user);
});

module.exports.Me = catchAsync(async function (req, res) {
  const user = await User.findById(req.user.id)
    .populate({
      path: "accounts.organisation",
      select: "name _id",
    })
    .populate({
      path: "accounts.organisationImage",
      select: "image",
    });

  if (!user) throw new AppError("No user was found", 404);

  sendSuccessResponseData(res, "user", user);
});

module.exports.getMyEvents = catchAsync(async (req, res) => {
  // if he is part of an organisation , get all events of that organisation
  // else check by just user id
  const queryConditions = req.user.organisationId
    ? [{ organisationId: req.user.organisationId }]
    : [{ userId: req.user.id }];

  const apiFeatures = new APIFEATURES(
    Event.find({
      $or: queryConditions,
    }),
    req.query
  )
    .filter()
    .sort()
    .paginate()
    .limitFields();

  const totalCount = await Event.find({
    $or: [{ userId: req.user.id }, { organisationId: req.user.organisationId }],
  }).countDocuments();

  console.log("totalCount", totalCount);
  const events = await apiFeatures.query;

  sendSuccessResponseData(res, "events", events, totalCount);
});

module.exports.searchUsers = catchAsync(async (req, res) => {
  console.log("searching users");
  const query = req.query.search;
  // dont find users that have accountType set to organisation and user
  const results = await User.find(
    {
      accountType: { $ne: "organisation" },
      $or: [
        { userName: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    },
    "id email userName image organisationId"
  );

  sendSuccessResponseData(res, "users", results);
});

// Remove the organisation id from the users accounts list when organisation has expired

// Set it back when the organisation renews
