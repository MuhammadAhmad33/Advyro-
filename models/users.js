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
    profilePic: {
        type: String,
        default: null,
    },
    role: {
        type: String,
        enum: ['customer', 'mid admin', 'super admin'],
        default: 'customer',
    },
    subscription: {
        plan: {
            type: String,
            enum: ['basic', 'standard', 'pro'],
            default: 'basic'
        },
        startDate: {
            type: Date,
            default: null,
        },
        expiryDate: { 
            type: Date,
            default: null,
        }
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
    fcmToken: {
        type: String,
        default: null,
    },
    
},{ timestamps: true });

module.exports = mongoose.model('User', UserSchema);
