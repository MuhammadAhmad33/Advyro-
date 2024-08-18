const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const superAdminController = require('../controllers/superAdminController');

// Super admin routes
router.post('/addCoin', auth, superAdminController.addCoin);
router.put('/updateCoin/:id', auth, superAdminController.updateCoin);
router.delete('/delete/:id',auth, superAdminController.deleteCoin);
router.get('/allCoins', superAdminController.getAllCoins);
//
router.post('/addSubs', auth, superAdminController.addSubscriptionPlan);
router.put('/updateSubs/:id', auth, superAdminController.updateSubscriptionPlan);
router.delete('/deleteSubs/:id',auth, superAdminController.deleteSubscriptionPlan);
router.get('/allPlans', superAdminController.getAllSubscriptionPlans);


module.exports = router;
