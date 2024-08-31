const StripeKey = require('../models/stripeKey'); // Adjust the path as needed

// Function to get Stripe secret key
async function getStripeKey(req, res) {
    try {
        const stripeKey = await StripeKey.findOne({});
        if (!stripeKey) {
            return res.status(404).json({ message: 'Stripe key not found' });
        }
        return res.status(200).json({ secretKey: stripeKey.secretKey });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

// Function to update Stripe secret key
async function updateStripeKey(req, res) {
    const { secretKey } = req.body;

    try {
        // Update or create the Stripe key
        const stripeKey = await StripeKey.findOneAndUpdate(
            {},
            { secretKey },
            { new: true, upsert: true } // Create if it doesn't exist
        );

        return res.status(200).json({ message: 'Stripe key updated successfully', stripeKey });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

module.exports = {
    getStripeKey,
    updateStripeKey,
};