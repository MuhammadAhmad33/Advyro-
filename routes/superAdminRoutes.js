const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const superAdminController = require('../controllers/superAdminController');

// Super admin routes
router.post('/addCoin', auth, superAdminController.addCoin);
router.put('/updateCoin/:id', auth, superAdminController.updateCoin);
router.delete('/delete/:id',auth, superAdminController.deleteCoin);
router.get('/allCoins', superAdminController.getAllCoins);

module.exports = router;
