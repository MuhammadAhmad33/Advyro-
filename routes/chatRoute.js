const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/chatController');

// Chat Routes
router.get('/', ChatController.getChatList); // Get chat list
router.get('/:userId', ChatController.getChatDetail); // Get chat details for a user
router.post('/send', ChatController.sendMessage); // Send message
router.post('/confirm-withdrawal', ChatController.confirmWithdrawal); // Confirm withdrawal

module.exports = router;
