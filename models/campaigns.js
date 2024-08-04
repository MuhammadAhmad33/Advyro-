const mongoose = require('mongoose');

const AnalyticsSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
    },
    impressions: {
        type: Number,
        required: true,
    },
    clicks: {
        type: Number,
        required: true,
    },
});

const CampaignSchema = new mongoose.Schema({
    adBanner: {
        type: String, // File path or URL
        required: true,
    },
    business: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Business',
        required: true,
    },
    adsName: {
        type: String,
        required: true,
    },
    websiteUrl: {
        type: String,
        required: true,
    },
    campaignDesc: {
        type: String,
        required: true,
    },
    campaignPlatforms: {
        type: [String], // Array of platforms
        required: true,
    },
    dateSchedule: {
        startDate: {
            type: Date,
            required: true,
        },
        endDate: {
            type: Date,
            required: true,
        },
    },
    startTime: {
        type: String, // e.g., "20:00" for 8 PM
        required: true,
    },
    endTime: {
        type: String, // e.g., "04:00" for 4 AM
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
    rejectionReason: {
        type: String,
        required: false,
    },
    analytics: [AnalyticsSchema], // Array of analytics data
    feePaid: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('Campaign', CampaignSchema);
