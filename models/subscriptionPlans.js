// models/SubscriptionPlan.js
const mongoose = require('mongoose');

const SubscriptionPlanSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    price: {
        type: Number,
        required: true
    },
    businessLimit: {
        type: Number,
        required: true
    },
    duration: { // Optional field with default
        type: Number,
        default: 3 // Default duration of 3 months
    },
    expiry: { // Add expiry field
        type: Date,
        default: function() {
            // Calculate expiry based on the createdAt timestamp
            return new Date(this.createdAt.getTime() + this.duration * 30 * 24 * 60 * 60 * 1000); // Duration in months converted to milliseconds
        }
    }
}, { timestamps: true });

module.exports = mongoose.model('SubscriptionPlan', SubscriptionPlanSchema);
