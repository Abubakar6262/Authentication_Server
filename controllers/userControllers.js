require("dotenv").config();
const { CatchAsyncError } = require("../middlewares/CatchAsyncErrors");
const userModel = require("../models/userModel");
const ErrorHandler = require("../utils/ErrorHandler");
const jwt = require("jsonwebtoken");
const ejs = require("ejs");
const path = require("path");
const { default: sendEmail } = require("../utils/sendEmail");
const cloudinary = require("cloudinary").v2;

// Register a new user
const registerUser = CatchAsyncError(async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return next(new ErrorHandler("Please provide all required fields", 400));
    }

    // Check if the email is already registered
    const isEmailExist = await userModel.findOne({ email });
    if (isEmailExist) {
      return next(new ErrorHandler("Email already exists", 400));
    }

    // Create activation code and token
    const activationCode = Math.floor(1000 + Math.random() * 9000).toString();

    const user = await userModel.create({
      name,
      email,
      password,
      activationCode: activationCode,
      activationCodeExpires: Date.now() + 15 * 60 * 1000, // 15 minutes expiration
    });
    res.status(201).json({
      success: true,
      message: "User registered successfully",
    });

    try {
      await sendEmail(
        user.email,
        "Account Activation",
        `Your activation code is ${activationCode}. It will expire in 15 minutes.`
      );
      res.status(201).json({
        success: true,
        message: `Activation code sent to ${user.email}`,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Resend activation code
const resendActivationCode = CatchAsyncError(async (req, res, next) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return next(new ErrorHandler("Email is required", 400));
    }

    // Find user by email
    const user = await userModel.findOne({ email });
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    // Generate new activation code
    const activationCode = Math.floor(1000 + Math.random() * 9000).toString();
    user.activationCode = activationCode;
    user.activationCodeExpires = Date.now() + 15 * 60 * 1000; // 15 minutes expiration
    await user.save();

    // Send email
    await sendEmail(
      user.email,
      "Account Activation",
      `Your new activation code is ${activationCode}. It will expire in 15 minutes.`
    );

    res.status(200).json({
      success: true,
      message: `Activation code resent to ${user.email}`,
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// activate user account
const activateUser = CatchAsyncError(async (req, res, next) => {
  try {
    const { email, activationCode } = req.body;

    if (!email || !activationCode) {
      return next(
        new ErrorHandler("Email and activation code are required", 400)
      );
    }

    // Find user by email
    const user = await userModel.findOne({ email });

    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    // Check if code matches
    if (user.activationCode !== activationCode) {
      return next(new ErrorHandler("Invalid activation code", 400));
    }

    // Check if code is expired
    if (user.activationCodeExpires < Date.now()) {
      return next(new ErrorHandler("Activation code has expired", 400));
    }

    // Activate account
    user.isVerified = true;
    user.activationCode = undefined;
    user.activationCodeExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Account activated successfully",
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Login user
const loginUser = CatchAsyncError(async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return next(new ErrorHandler("Please provide all required fields", 400));
    }

    // Find user & include password for comparison
    const user = await userModel.findOne({ email }).select("+password");
    if (!user) {
      return next(new ErrorHandler("Invalid email or password", 401));
    }

    // Compare password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return next(new ErrorHandler("Invalid email or password", 401));
    }

    // Check if account is verified
    if (!user.isVerified) {
      return next(new ErrorHandler("Please activate your account", 403));
    }

    // Generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Cookie options
    const cookieOptions = {
      httpOnly: true, // Can't access via JS
      secure: process.env.NODE_ENV === "production", // Only HTTPS in prod
      sameSite: "strict",
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
    };

    // Send cookies + response
    res
      .status(200)
      .cookie("accessToken", accessToken, {
        ...cookieOptions,
        maxAge: 5 * 60 * 1000,
      }) // 5 min
      .cookie("refreshToken", refreshToken, cookieOptions) // 3 days
      .json({
        success: true,
        message: "Logged in successfully",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Logout user
const logoutUser = CatchAsyncError(async (req, res, next) => {
  try {
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    const userId = req.user?._id
    if (!userId) {
      return next(new ErrorHandler("User not authenticated", 401));
    }

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// update access token
const updateAccessToken = CatchAsyncError(async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return next(
        new ErrorHandler("Please login to access this resource", 401)
      );
    }

    // Verify refresh token
    let decodedData;
    try {
      decodedData = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (err) {
      return next(new ErrorHandler("Invalid or expired refresh token", 401));
    }

    // Find user by ID
    const user = await userModel.findById(decodedData.id).select("_id role");
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    // Generate new tokens
    const newAccessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "5m" }
    );

    const newRefreshToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "3d" }
    );

    // Set cookies
    res.cookie("accessToken", newAccessToken);
    res.cookie("refreshToken", newRefreshToken);

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// get user info
const getUserInfo = CatchAsyncError(async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return next(new ErrorHandler("User not authenticated", 401));
    }

    // get user from db
    const user = await userModel.findById(userId).select("-password");
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    res.status(200).json({
      success: true,
      user,
    });

  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// social auth
const socialAuth = CatchAsyncError(async (req, res, next) => {
  try {
    const { email, name, avatar } = req.body;
    if (!email || !name) {
      return next(new ErrorHandler("Please provide all required fields", 400));
    }
    const existingUser = await userModel.findOne({ email });

    if (existingUser) {
      sendToken(existingUser, 200, res);
    } else {
      const newUser = await userModel.create({
        name: name,
        email: email,
        password: "socialAuthPassword", // Placeholder password
      });
      sendToken(newUser, 201, res);
    }
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// update user info
const updateUserInfo = CatchAsyncError(async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return next(new ErrorHandler("User not authenticated", 401));
    }

    const { name } = req.body;
    if (!name) {
      return next(new ErrorHandler("Please provide all required fields", 400));
    }

    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      { name },
      { new: true }
    );
    if (!updatedUser) {
      return next(new ErrorHandler("User not found", 404));
    }
    res.status(200).json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// update user password
const updateUserPassword = CatchAsyncError(async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return next(new ErrorHandler("User not authenticated", 401));
    }

    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return next(new ErrorHandler("Please provide all required fields", 400));
    }

    const user = await userModel.findById(userId).select("+password");
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return next(new ErrorHandler("Old password is incorrect", 400));
    }

    user.password = newPassword;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// update profile picture
const updateProfilePicture = CatchAsyncError(async (req, res, next) => {
  try {
    const userId = req.user?._id?.toString();
    if (!userId) {
      return next(new ErrorHandler("User not authenticated", 401));
    }

    const { avatar } = req.body;
    if (!avatar) {
      return next(new ErrorHandler("Please provide an avatar URL", 400));
    }

    // Get user first to access existing avatar info
    const user = await userModel.findById(userId);
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    // Upload new avatar to Cloudinary
    const uploadAtCloud = await cloudinary.uploader.upload(avatar, {
      folder: "lms/user/avatars",
      width: 150,
    });

    // Delete previous avatar from Cloudinary if it exists
    if (user.avatar?.public_id) {
      await cloudinary.uploader.destroy(user.avatar.public_id);
    }

    // Update user with new avatar info
    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      {
        avatar: {
          public_id: uploadAtCloud?.public_id,
          url: uploadAtCloud?.secure_url,
        },
      },
      { new: true }
    );

    // Cache updated user
    await redisClient().set(userId, JSON.stringify(updatedUser));

    res.status(200).json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

module.exports = {
  registerUser,
  activateUser,
  resendActivationCode,
  loginUser,
  logoutUser,
  updateAccessToken,
  getUserInfo,
  socialAuth,
  updateUserInfo,
  updateUserPassword,
  updateProfilePicture,
};
