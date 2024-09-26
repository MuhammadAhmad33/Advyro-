const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  messages: [
    {
      message_type: {
        type: String,
        enum: ['message', 'withdraw'],
        required: true,
      },
      text: {
        type: String,
        default: '', // Default to an empty string
      },
      bank_name: {
        type: String,
        default: '', // Default to an empty string
      },
      account_title: {
        type: String,
        default: '', // Default to an empty string
      },
      IBAN: {
        type: String,
        default: '', // Default to an empty string
      },
      amount: {
        type: Number,
        default: 0, // Default to 0
      },
      status: {
        type: String,
        enum: ['pending', 'confirmed'],
        default: 'pending', 
      },
      created_at: {
        type: Date,
        default: Date.now,
      },
      is_read: {
        type: Boolean,
        default: false,
      },
      sender: {
        type: String,
        enum: ['user', 'admin'],
        required: true,
        default: 'user', // Default to 'user'
      },
    },
  ],
  last_message: {
    type: String,
    default: '', // Default to an empty string
  },
  last_message_time: {
    type: Date,
    default: Date.now, // Default to current time
  },
  last_message_read: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model('Chat', chatSchema);
