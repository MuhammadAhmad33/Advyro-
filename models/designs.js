const mongoose = require('mongoose');

const AdBannerDesignSchema = new mongoose.Schema({
    fileUrl: {
        type: String, // URL of the uploaded design
        required: true,
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the user (mid admin) who uploaded the design
        required: true,
    },
    uploadDate: {
        type: Date,
        default: Date.now,
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the users who liked the design
        default: [] // Ensure an empty array by default
    }],
    dislikes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the users who disliked the design
        default: [] // Ensure an empty array by default
    }],
});

module.exports = mongoose.model('AdBannerDesign', AdBannerDesignSchema);
