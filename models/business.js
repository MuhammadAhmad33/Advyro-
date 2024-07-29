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
        type: [String], // Array of file paths or URLs
        required: false,
    },
    logo: {
        type: String, // Single file path or URL
        required: false,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending',
    },
    campaigns: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaign',
    }],
});

module.exports = mongoose.model('Business', BusinessSchema);
