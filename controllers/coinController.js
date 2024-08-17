// controllers/coinController.js
const User = require('../models/users');
const Coin = require('../models/coin');
const config = require('../config/config');
const stripe = require('stripe')(config.STRIPE_SECRET_KEY);
const { validationResult } = require('express-validator');

async function purchaseCoins(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { coinAmount } = req.body;
    const userId = req.user._id;

    try {
        const coin = await Coin.findOne({ amount: coinAmount });
        if (!coin) {
            return res.status(400).json({ message: 'Invalid coin amount' });
        }

        // Create a PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: coin.priceInCents,
            currency: 'usd',
            payment_method_types: ['card'],
            metadata: {
                userId: userId.toString(),
                coinAmount: coinAmount.toString()
            }
        });

        // Send the client secret to the client
        res.status(200).json({
            clientSecret: paymentIntent.client_secret,
            amountInCents: coin.priceInCents,
            noOfCoins: coinAmount
        });

    } catch (error) {
        console.error('Error creating PaymentIntent:', error);
        res.status(500).json({ message: 'An error occurred while creating the payment intent' });
    }
}

async function handleSuccessfulPayment(req, res) {
    const { paymentIntentId } = req.body;

    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status === 'succeeded') {
            const userId = paymentIntent.metadata.userId;
            const coinAmount = parseInt(paymentIntent.metadata.coinAmount);

            const user = await User.findById(userId);
            user.coinBalance += coinAmount;
            await user.save();

            res.status(200).json({
                message: 'Coin purchase successful',
                coinsPurchased: coinAmount,
                newBalance: user.coinBalance
            });
        } else {
            res.status(400).json({ message: 'Payment not successful' });
        }
    } catch (error) {
        console.error('Error handling successful payment:', error);
        res.status(500).json({ message: 'An error occurred while processing the payment' });
    }
}

async function getCoinBalance(req, res) {
    try {
        const user = await User.findById(req.user._id);
        res.status(200).json({ coinBalance: user.coinBalance });
    } catch (error) {
        console.error('Error fetching coin balance:', error);
        res.status(500).json({ message: 'An error occurred while fetching the coin balance' });
    }
}

module.exports = {
    purchaseCoins,
    handleSuccessfulPayment,
    getCoinBalance,
};