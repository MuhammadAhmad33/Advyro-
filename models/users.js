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
    },
    subscription: {
        plan: {
            type: String,
            enum: ['basic', 'standard', 'pro']
        },
        startDate: {
            type: Date,
            default: null,
        },
    },
    businesses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Business'
    }],
    coinBalance: {
        type: Number,
        default: 0
    },
    permissions: {
        campaigns: {
            manage: {
                type: Boolean,
                default: false,
            },
        },
        businesses: {
            manage: {
                type: Boolean,
                default: false,
            },
        },
        adBannerDesigns: {
            manage: {
                type: Boolean,
                default: false,
            },
        },
    },
});

module.exports = mongoose.model('User', UserSchema);
