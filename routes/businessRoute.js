const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const auth = require('../middleware/auth');
const businessController = require('../controllers/businessController');

// Route to add business
router.post('/add-business', [
    auth,
    check('name').notEmpty().withMessage('Business name is required'),
    check('phone').notEmpty().withMessage('Phone number is required'),
    check('location').notEmpty().withMessage('Location is required'),
    check('targetMapArea').notEmpty().withMessage('Target map area is required'),
    check('description').notEmpty().withMessage('Business description is required'),
], businessController.addBusiness);

// Route to get user's businesses
router.get('/my-businesses', auth, businessController.getUserBusinesses);

// Route to select subscription plan
router.post('/select-plan', [
    auth,
    check('plan').isIn(['basic', 'standard', 'pro']).withMessage('Invalid subscription plan'),
], businessController.selectSubscriptionPlan);

router.put('/edit', auth, businessController.editBusiness);


module.exports = router;
