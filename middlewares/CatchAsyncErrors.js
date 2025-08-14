const CatchAsyncError = (func) => (req, res, next) => {
    Promise.resolve(func(req, res, next))
        .catch((error) => {
            // Log the error for debugging
            console.error('Async Error:', error);
            // Pass the error to the next middleware (ErrorMiddleware)
            next(error);
        });
}

module.exports = { CatchAsyncError };