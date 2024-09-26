const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const chatController = require('../controllers/chatController');

// GET wallet by user ID
router.get('/:userId', walletController.getWalletAndWithdrawalInfo);

// POST to add amount to wallet
router.post('/add/:userId', walletController.addAmountToWallet);

// POST to send a withdrawal request (Handled by ChatController as specified)
router.post('/withdraw', chatController.sendWithdrawalRequest);

module.exports = router;
