const mongoose = require('mongoose');

const BusinessSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    location: {
        type: String,
        required: true,
    },
    targetMapArea: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    gallery: {
        type: [String],
        required: false,
    },
    logo: {
        type: String,
        required: false,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    managedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending',
    },
    rejectionReason: {
        type: String,
        required: false,
    },
    statusChangedBy: 
    { 
        type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false
    }, 
    websiteUrl: {
        type: String,
        required: false,
    },
    facebookUrl: {
        type: String,
        required: false,
    },
    instagramUrl: {
        type: String,
        required: false,
    },
    linkedinUrl: {
        type: String,
        required: false,
    },
    tiktokUrl: {
        type: String,
        required: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Business', BusinessSchema);