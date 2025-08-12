require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please enter your name'],
        minlength: [3, 'Name must be at least 3 characters long']
    },
    email: {
        type: String,
        required: [true, 'Please enter your email'],
        unique: true,
        validate: {
            validator: function (v) {
                return emailRegex.test(v);
            },
            message: props => `${props.value} is not a valid email!`
        }
    },
    password: {
        type: String,
        minlength: [6, 'Password must be at least 6 characters long'],
        select: false
    },
    avatar: {
        public_id: {
            type: String,
            required: false
        },
        url: {
            type: String,
            required: false
        }
    },
    role: {
        type: String,
        enum: ['admin', 'student'],
        default: 'student'
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    activationCode: {
        type: String,
        required: false
    },
    activationCodeExpires: {
        type: Date,
        required: false
    },
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Sign access token
userSchema.methods.generateAccessToken = function () {
    return jwt.sign({ id: this._id, role: this.role }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '5m'
    });
}

// Sign refresh token
userSchema.methods.generateRefreshToken = function () {
    return jwt.sign({ id: this._id, role: this.role }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: '3d'
    });
}

// ccompare password
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};


module.exports = mongoose.model('User', userSchema);
