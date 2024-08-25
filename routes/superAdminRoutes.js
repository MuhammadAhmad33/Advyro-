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
router.get('/management-requests',superAdminController.viewManagementrequests);
router.get('/users/subscriptions', superAdminController.getAllUserEmailsAndSubscriptions);
router.get('/adminCode',auth,superAdminController.generateCode);
router.get('/midAdmins',superAdminController.getAllMidAdmins);
router.get('/subscriptions/counts', superAdminController.getSubscriptionCounts);
// Route to update mid admin permissions
router.patch('/permissions/:id',superAdminController.updateMidAdminPermissions);

module.exports = router;
