const mongoose = require('mongoose');

const ManagementRequestSchema = new mongoose.Schema({
    midAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    business: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Business',
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'denied'],
        default: 'pending',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('ManagementRequest', ManagementRequestSchema);