// controllers/coinController.js
const User = require('../models/users');
const Coin = require('../models/coin');
const ManagementRequest = require('../models/managementReq'); 
const SubscriptionPlan = require('../models/subscriptionPlans');
const AdminCode= require('../models/adminCode')
const Business= require('../models/business');
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
        if (await Coin.findOne({ amount })) {
            return res.status(400).json({ message: 'Coin already exists' });

        }
        await newCoin.save();
        res.status(201).json({ message: 'Coin added successfully', coin: newCoin });
    } catch (error) {
        console.error('Error adding coin:', error);
        res.status(500).json({ message: error.message });
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

async function addSubscriptionPlan(req, res) {
    if (!isSuperAdmin(req.user)) {
        return res.status(403).json({ message: 'Access denied. Super admin rights required.' });
    }

    const { name, price, businessLimit } = req.body;

    try {
        const newPlan = new SubscriptionPlan({ name, price, businessLimit });
        await newPlan.save();
        res.status(201).json({ message: 'Subscription plan added successfully', plan: newPlan });
    } catch (error) {
        console.error('Error adding subscription plan:', error);
        res.status(500).json({ message: 'An error occurred while adding the subscription plan' });
    }
}

async function updateSubscriptionPlan(req, res) {
    if (!isSuperAdmin(req.user)) {
        return res.status(403).json({ message: 'Access denied. Super admin rights required.' });
    }

    const { id } = req.params;
    const { name, price, businessLimit } = req.body;

    try {
        const updatedPlan = await SubscriptionPlan.findByIdAndUpdate(id, { name, price, businessLimit }, { new: true });
        if (!updatedPlan) {
            return res.status(404).json({ message: 'Subscription plan not found' });
        }
        res.status(200).json({ message: 'Subscription plan updated successfully', plan: updatedPlan });
    } catch (error) {
        console.error('Error updating subscription plan:', error);
        res.status(500).json({ message: 'An error occurred while updating the subscription plan' });
    }
}

async function deleteSubscriptionPlan(req, res) {
    if (!isSuperAdmin(req.user)) {
        return res.status(403).json({ message: 'Access denied. Super admin rights required.' });
    }

    const { id } = req.params;

    try {
        const deletedPlan = await SubscriptionPlan.findByIdAndDelete(id);
        if (!deletedPlan) {
            return res.status(404).json({ message: 'Subscription plan not found' });
        }
        res.status(200).json({ message: 'Subscription plan deleted successfully' });
    } catch (error) {
        console.error('Error deleting subscription plan:', error);
        res.status(500).json({ message: 'An error occurred while deleting the subscription plan' });
    }
}

async function getAllSubscriptionPlans(req, res) {
    try {
        const plans = await SubscriptionPlan.find();
        res.status(200).json(plans);
    } catch (error) {
        console.error('Error fetching subscription plans:', error);
        res.status(500).json({ message: 'An error occurred while fetching subscription plans' });
    }
}
// Endpoint to get all management requests
async function viewManagementrequests(req, res){
    try {
        const requests = await ManagementRequest.find()
            .populate('midAdmin', 'fullname email') // Populate mid admin details
            .populate('business'); // Populate business details

        return res.status(200).json({ requests });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Function to get all users' emails and their subscription plans
async function getAllUserEmailsAndSubscriptions(req, res) {
    try {
        // Fetch all users and select only the email and subscription fields
        const users = await User.find({}, 'email subscription.plan'); // Select email and subscription plan

        // Map the results to a more readable format
        const result = users.map(user => ({
            email: user.email,
            subscriptionPlan: user.subscription.plan || 'No subscription' // Handle cases where there is no subscription
        }));

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({ message: 'Error fetching users', error: error.message });
    }
};

// Function to get all mid admins
async function getAllMidAdmins(req, res) {
    try {
        // Find all users with the role of 'mid admin'
        const midAdmins = await User.find({ role: 'mid admin' }).select('fullname'); // Select specific fields

        return res.status(200).json(midAdmins);
    } catch (error) {
        console.error('Error fetching mid admins:', error);
        return res.status(500).json({ message: 'Error fetching mid admins', error: error.message });
    }
};
// Endpoint to generate a 6-digit signup code for mid admins
async function generateCode(req, res) {
    try {
        const superAdminId = req.user._id; // Assuming req.user contains the authenticated super admin's data

        // Generate a 6-digit random code
        const signupCode = Math.floor(100000 + Math.random() * 900000).toString();
        console.log('Generated signup code:', signupCode);

        const adminCode = new AdminCode({
            code: signupCode,
            createdBy: superAdminId,
        });

        // Save the code to the database
        await adminCode.save();
        console.log('Code saved to DB:', adminCode);

        return res.status(200).json({ message: 'Signup code generated', adminCode });
    } catch (error) {
        console.error('Error generating code:', error);
        return res.status(500).json({ message: error.message });
    }
}

async function updateMidAdminPermissions(req, res) {
    const { id } = req.params;
    const { permissions } = req.body;

    try {
        // Find the mid admin user
        const midAdmin = await User.findById(id);
        if (!midAdmin || midAdmin.role !== 'mid admin') {
            return res.status(404).json({ message: 'Mid admin not found' });
        }

        // Update the mid admin permissions
        midAdmin.permissions = permissions;
        await midAdmin.save();

        return res.status(200).json({ message: 'Mid admin permissions updated', midAdmin });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

async function getSubscriptionCounts(req, res) {
    try {
        // Aggregate the counts of each subscription plan
        const subscriptionCounts = await User.aggregate([
            {
                $group: {
                    _id: "$subscription.plan", // Group by subscription plan
                    count: { $sum: 1 } // Count each occurrence
                }
            },
            {
                $project: {
                    _id: 0, // Exclude the _id field from the output
                    plan: "$_id", // Rename _id to plan
                    count: 1 // Include the count
                }
            }
        ]);

        // Return the subscription counts
        return res.status(200).json(subscriptionCounts);
    } catch (error) {
        console.error('Error fetching subscription counts:', error);
        return res.status(500).json({ message: 'Error fetching subscription counts', error: error.message });
    }
};

// Endpoint to approve or reject management requests
async function handleManagementRequest(req, res) {
    const { requestId, action } = req.body; // action should be 'approve' or 'reject'

    try {
        // Find the management request by ID
        const request = await ManagementRequest.findById(requestId)
            .populate('business'); // Populate business details

        if (!request) {
            return res.status(404).json({ message: 'Management request not found' });
        }

        // Handle the action (approve or reject)
        if (action === 'approve') {
            // Update the request status to approved
            request.status = 'approved';
            await request.save();

            // Update the corresponding business to set the managedBy field to the mid admin
            const updatedBusiness = await Business.findByIdAndUpdate(
                request.business,
                {
                    managedBy: request.midAdmin, // Set the managedBy field to the mid admin
                },
                { new: true } // Return the updated document
            ).populate('managedBy'); // Populate the managedBy field to get user details

            return res.status(200).json({
                message: 'Management request approved',
                request,
                business: updatedBusiness // Include the updated business in the response
            });
        } else if (action === 'reject') {
            // Update the request status to denied
            request.status = 'denied';
            await request.save();

            return res.status(200).json({ message: 'Management request denied', request });
        } else {
            return res.status(400).json({ message: 'Invalid action. Use "approve" or "reject".' });
        }
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Function to delete a mid admin
async function deleteMidAdmin(req, res) {
    const userId = req.params.id; // Assuming the user ID is passed in the URL

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the user is a mid admin
        if (user.role !== 'mid admin') {
            return res.status(400).json({ message: 'User is not a mid admin' });
        }

        // Delete the mid admin
        await User.findByIdAndDelete(userId);
        return res.status(200).json({ message: 'Mid admin deleted successfully' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

module.exports = {
    addCoin,
    updateCoin,
    deleteCoin,
    getAllCoins,
    addSubscriptionPlan,
    updateSubscriptionPlan,
    deleteSubscriptionPlan,
    getAllSubscriptionPlans,
    viewManagementrequests,
    getAllUserEmailsAndSubscriptions,
    generateCode,
    getAllMidAdmins,
    updateMidAdminPermissions,
    getSubscriptionCounts,
    handleManagementRequest,
    deleteMidAdmin,
};