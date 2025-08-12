const ErrorHandler = require("../utils/ErrorHandler");

const ErrorMiddleware = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // Log the error details for debugging
    console.error(`Error: ${message}`);
    console.error(`Status Code: ${statusCode}`);
    console.error(`Stack Trace: ${err.stack}`);

    //wrong mongoDB id
    if (err.name === 'CastError') {
        const message = `Resource not found. Invalid: ${err.path}`;
        err = new ErrorHandler(message, 400);
    }

    // Duplicate key error
    if (err.code === 11000) {
        const message = `Duplicate field value entered: ${Object.keys(err.keyValue).join(', ')}`;
        err = new ErrorHandler(message, 400);
    }

    // wrong JWT error
    if (err.name === 'JsonWebTokenError') {
        const message = 'JSON Web Token is invalid. Try again';
        err = new ErrorHandler(message, 400);
    }

    // jwt expired error
    if (err.name === 'TokenExpiredError') {
        const message = 'JSON Web Token has expired. Try again';
        err = new ErrorHandler(message, 400);
    }

    // Send the error response
    res.status(err.statusCode).json({
        success: false,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined, // Show stack trace only in development
    });
}

module.exports = ErrorMiddleware;