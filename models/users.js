const mongoose = require('mongoose');

// Define the User schema
const UserSchema = new mongoose.Schema({
    fullname: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    address: {
        type: String,
        required: true,
    },
    phoneNumber: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    confirmPassword: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['customer', 'mid admin', 'super admin'],
        default: 'customer',
        required: true,
    }
});



module.exports = mongoose.model('User', UserSchema);
