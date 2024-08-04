const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const auth = require('../middleware/auth');
const coinController = require('../controllers/coinController');

router.post('/purchase-coins', [
    auth,
    check('coinAmount').isIn([100, 250, 500, 1000, 2000, 5000, 10000]).withMessage('Invalid coin amount'),
], coinController.purchaseCoins);

router.post('/confirm-payment', [
    auth,
    check('paymentIntentId').notEmpty().withMessage('Payment Intent ID is required'),
], coinController.handleSuccessfulPayment);

router.get('/coin-balance', auth, coinController.getCoinBalance);

module.exports = router;