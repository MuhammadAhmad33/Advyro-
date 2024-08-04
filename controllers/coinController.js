const User = require('../models/users');
const Business = require('../models/business');
const config=require('../config/config')
const stripe = require('stripe')(config.STRIPE_SECRET_KEY);
const { validationResult } = require('express-validator');


const coinPrices = {
    100: 128,   // $1.28
    250: 320,   // $3.20
    500: 640,   // $6.40
    1000: 1280, // $12.80
    2000: 2560, // $25.60
    5000: 6400, // $64.00
    10000: 12800 // $128.00
};

async function purchaseCoins(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { coinAmount } = req.body;
    const userId = req.user._id;

    try {
        const amountInCents = coinPrices[coinAmount];
        if (!amountInCents) {
            return res.status(400).json({ message: 'Invalid coin amount' });
        }

        // Create a PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
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
            amountinCents: amountInCents,
            noOfCoins: coinAmount
        });

    } catch (error) {
        console.error('Error creating PaymentIntent:', error);
        res.status(500).json({ message: 'An error occurred while creating the payment intent' });
    }
}

// New function to handle successful payments
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
    getCoinBalance
}