const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const campaignController = require('../controllers/campaignController');

// Route to create a new campaign
router.post('/add', auth, campaignController.createCampaign);

// Route to get all campaigns for a specific business
router.get('/business/:businessId', auth, campaignController.getCampaigns);


module.exports = router;
