const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripeKeyController'); // Adjust the path as needed

// Route to get Stripe secret key
router.get('/get', stripeController.getStripeKey);

// Route to update Stripe secret key
router.put('/editkey', stripeController.updateStripeKey);

module.exports = router;