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


// Route to get all design requests
router.get('/design-requests', midAdminController.getAllDesignRequests);

router.get('/allBusinessesandCampaigns', midAdminController.getAllBusinessesWithCampaigns);
// Route to update the status of a design request
router.patch('/design-requests/:requestId', midAdminController.updateDesignRequestStatus);

// Route to get businesses based on status
router.get('/businesses/:status', midAdminController.getBusinessesByStatus);

// Route to get campaigns based on status
router.get('/campaigns/:status', midAdminController.getCampaignsByStatus);
router.post('/upload-design', auth, midAdminController.uploadDesign);
router.post('/campaigns/:campaignId/analytics', midAdminController.addAnalyticsData);


module.exports = router;
