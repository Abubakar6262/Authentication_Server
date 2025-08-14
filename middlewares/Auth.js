const { CatchAsyncError } = require("./CatchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel"); // Make sure path is correct

// Middleware to check if user is authenticated
const isAuthenticated = CatchAsyncError(async (req, res, next) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return next(new ErrorHandler("Please login to access this resource", 401));
  }

  let decodedData;
  try {
    decodedData = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch (err) {
    return next(
      new ErrorHandler("Invalid or expired token, please login again", 401)
    );
  }

  // OPTIONAL: Verify user still exists
  const user = await userModel.findById(decodedData.id).select("-password");
  if (!user) {
    return next(new ErrorHandler("User not found, please login again", 404));
  }

  req.user = user; 
  next();
});

// Middleware to validate user role
const validateUserRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorHandler(
          "You do not have permission to access this resource",
          403
        )
      );
    }
    next();
  };
};

module.exports = { isAuthenticated, validateUserRole };
