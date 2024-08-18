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
    }
}, { timestamps: true });

module.exports = mongoose.model('SubscriptionPlan', SubscriptionPlanSchema);