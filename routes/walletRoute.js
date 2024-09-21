const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');

// Get Wallet Balance
router.get('/:userId', walletController.getWalletBalance);

// Get Payment History
router.get('/:userId/payments', walletController.getPaymentHistory);

// Get Withdrawal History
router.get('/:userId/withdrawals', walletController.getWithdrawalHistory);

// Withdraw Amount
router.post('/withdraw', walletController.withdrawAmount);

// Add Refund to Wallet
router.post('/refund', walletController.addRefundToWallet);

module.exports = router;
