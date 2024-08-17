// models/coin.js
const mongoose = require('mongoose');

const coinSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true,
        unique: true
    },
    priceInCents: {
        type: Number,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Coin', coinSchema);