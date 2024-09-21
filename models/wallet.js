const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  balance: {
    type: Number,
    default: 0.0,  // User's current wallet balance
  },
  last_updated: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Wallet', walletSchema);
