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
});

module.exports = mongoose.model('AdBannerDesign', AdBannerDesignSchema);
