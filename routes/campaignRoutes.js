const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const campaignController = require('../controllers/campaignController');

// Route to create a new campaign
router.post('/add', auth, campaignController.createCampaign);

router.post('/request-designs', auth, campaignController.requestMoreDesigns);

router.post('/pay-fee', auth, campaignController.payCampaignFee);

router.post('/cancel', auth, campaignController.cancelCampaign);

router.get('/allDesigns',campaignController.getAllDesigns)

router.get('/campaignsByStatus', auth, campaignController.getCampaignsByStatus);


// Route to get all campaigns for a specific business
router.get('/business/:businessId',auth,campaignController.getCampaigns);


module.exports = router;
