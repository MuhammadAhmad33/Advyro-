const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const auth = require('../middleware/auth');
const { changeBusinessStatus } = require('../controllers/midAdminController');


// Route for mid-admin to change business status
router.post('/change-business-status', [
    auth,
    check('businessId').notEmpty().withMessage('Business ID is required'),
    check('status').isIn(['accepted', 'rejected']).withMessage('Status must be either accepted or rejected'),
], changeBusinessStatus);

// Route to update the status of a campaign
router.patch('/campaign/status', auth, campaignController.updateCampaignStatus);

module.exports = router;
