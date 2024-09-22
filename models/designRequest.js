const mongoose = require('mongoose');
const { Schema } = mongoose;
const customDesignRequestSchema = new Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, required: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    response: { type: String }, // Optional response from mid-admin
    statusChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // New field to store the user who changed the status
    comment: {type: String, default: "", required: false}
}, { timestamps: true });

module.exports = mongoose.model('CustomDesignRequest', customDesignRequestSchema);
