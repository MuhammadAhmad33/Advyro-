// controllers/coinController.js
const User = require('../models/users');
const Coin = require('../models/coin');
const config = require('../config/config');

// Helper function to check if user is super admin
function isSuperAdmin(user) {
    return user && user.role === 'super admin';
}

// New functions for super admin

async function addCoin(req, res) {
    if (!isSuperAdmin(req.user)) {
        return res.status(403).json({ message: 'Access denied. Super admin rights required.' });
    }

    const { amount, priceInCents } = req.body;

    try {
        const newCoin = new Coin({ amount, priceInCents });
        await newCoin.save();
        res.status(201).json({ message: 'Coin added successfully', coin: newCoin });
    } catch (error) {
        console.error('Error adding coin:', error);
        res.status(500).json({ message: 'An error occurred while adding the coin' });
    }
}

async function updateCoin(req, res) {
    if (!isSuperAdmin(req.user)) {
        return res.status(403).json({ message: 'Access denied. Super admin rights required.' });
    }

    const { id } = req.params;
    const { amount, priceInCents } = req.body;

    try {
        const updatedCoin = await Coin.findByIdAndUpdate(id, { amount, priceInCents }, { new: true });
        if (!updatedCoin) {
            return res.status(404).json({ message: 'Coin not found' });
        }
        res.status(200).json({ message: 'Coin updated successfully', coin: updatedCoin });
    } catch (error) {
        console.error('Error updating coin:', error);
        res.status(500).json({ message: 'An error occurred while updating the coin' });
    }
}

async function deleteCoin(req, res) {
    if (!isSuperAdmin(req.user)) {
        return res.status(403).json({ message: 'Access denied. Super admin rights required.' });
    }

    const { id } = req.params;

    try {
        const deletedCoin = await Coin.findByIdAndDelete(id);
        if (!deletedCoin) {
            return res.status(404).json({ message: 'Coin not found' });
        }
        res.status(200).json({ message: 'Coin deleted successfully' });
    } catch (error) {
        console.error('Error deleting coin:', error);
        res.status(500).json({ message: 'An error occurred while deleting the coin' });
    }
}

async function getAllCoins(req, res) {
   
    try {
        const coins = await Coin.find();
        res.status(200).json(coins);
    } catch (error) {
        console.error('Error fetching coins:', error);
        res.status(500).json({ message: 'An error occurred while fetching coins' });
    }
}

module.exports = {
    addCoin,
    updateCoin,
    deleteCoin,
    getAllCoins
};