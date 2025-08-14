const express = require('express');
const { connectDB } = require('./config/DB');
const dotenv = require('dotenv').config()
const cors = require('cors');
const cookieparser = require('cookie-parser');
const ErrorMiddleware = require('./middlewares/Error');


const app = express();
app.use(ErrorMiddleware);
app.use(express.json());
app.use(cookieparser());
app.use(express.urlencoded({ extended: false }))

// CORS configuration
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true, // Allow cookies to be sent with requests
}));


const PORT = process.env.PORT || 8000;


// Import routes
const userRouter = require('./routes/userRoutes');



// database connection call
try {
    connectDB();
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
} catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
}

// server entry route test
app.get('/', (req, res) => {
    res.send('Server is running');
});

// Use routes
app.use('/api/v1/users', userRouter);
