const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const auth = require('../middleware/auth');
const midAdminController = require('../controllers/midAdminController');

// Route for mid-admin to change business status
router.patch('/change-business-status', [
    auth,
    check('businessId').notEmpty().withMessage('Business ID is required'),
    check('status').isIn(['accepted', 'rejected']).withMessage('Status must be either accepted or rejected'),
    check('rejectionReason').optional().notEmpty().withMessage('Rejection reason is required if status is rejected'),
], midAdminController.changeBusinessStatus);

// Route to update the status of a campaign
router.patch('/campaign/status', [
    auth,
    check('campaignId').notEmpty().withMessage('Campaign ID is required'),
    check('status').isIn(['approved', 'rejected']).withMessage('Status must be either approved or rejected'),
    check('rejectionReason').optional().notEmpty().withMessage('Rejection reason is required if status is rejected'),
], midAdminController.updateCampaignStatus);

module.exports = router;
