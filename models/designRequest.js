// models/customDesignRequest.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const customDesignRequestSchema = new Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    response: { type: String }, // Optional response from mid-admin
}, { timestamps: true });

module.exports = mongoose.model('CustomDesignRequest', customDesignRequestSchema);
