// controllers/coinController.js
const User = require('../models/users');
const Coin = require('../models/coin');
const ManagementRequest = require('../models/managementReq'); 
const SubscriptionPlan = require('../models/subscriptionPlans');
const AdminCode= require('../models/adminCode')
const Business= require('../models/business');
const Campaign= require('../models/campaigns')
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

        // Sort the plans in the order: Basic, Standard, Pro, regardless of case
        const order = ['Basic', 'Standard', 'Pro'];
        const sortedPlans = plans.sort((a, b) => {
            return order.indexOf(capitalizeFirstLetter(a.name)) - order.indexOf(capitalizeFirstLetter(b.name));
        });

        // Capitalize the first letter of each plan's name before returning the response
        const formattedPlans = sortedPlans.map(plan => ({
            ...plan._doc, // Spread the plan object to keep other fields intact
            name: capitalizeFirstLetter(plan.name) // Capitalize the first letter of the name
        }));

        res.status(200).json(formattedPlans);
    } catch (error) {
        console.error('Error fetching subscription plans:', error);
        res.status(500).json({ message: 'An error occurred while fetching subscription plans' });
    }
}

// Helper function to capitalize the first letter of a string and make the rest lowercase
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
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
        // Aggregate the counts of each subscription plan and total user count
        const subscriptionCounts = await User.aggregate([
            {
                $facet: {
                    totalUsers: [
                        { $count: "count" } // Count total users
                    ],
                    plans: [
                        { $match: { "subscription.plan": { $ne: null } } }, // Filter out null plans
                        {
                            $group: {
                                _id: "$subscription.plan", // Group by subscription plan
                                count: { $sum: 1 } // Count occurrences
                            }
                        },
                        {
                            $project: {
                                _id: 0, // Exclude the _id field from the output
                                plan: "$_id", // Rename _id to plan
                                count: 1 // Include the count
                            }
                        }
                    ]
                }
            },
            {
                $project: {
                    users: { $arrayElemAt: ["$totalUsers.count", 0] }, // Extract total user count
                    plans: 1 // Keep the plans array
                }
            }
        ]);

        // Define the default plans with a count of 0
        const defaultPlans = [
            { plan: "basic", count: 0 },
            { plan: "standard", count: 0 },
            { plan: "pro", count: 0 }
        ];

        // Create a map for existing counts for quick look-up
        const countsMap = new Map(subscriptionCounts[0].plans.map(sub => [sub.plan, sub.count]));

        // Merge the default plans with the results from the database
        const mergedCounts = defaultPlans.map(defaultPlan => ({
            plan: defaultPlan.plan,
            count: countsMap.get(defaultPlan.plan) || defaultPlan.count // Use existing count or default
        }));

        // Prepare the final response
        const response = {
            users: subscriptionCounts[0].users || 0, // Total user count
            plans: mergedCounts // Merged subscription counts
        };

        // Return the final response
        return res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching subscription counts:', error);
        return res.status(500).json({ message: 'Error fetching subscription counts', error: error.message });
    }
}


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

async function getMonthlyStats(req, res) {
    try {
        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        // Fetch counts for users, campaigns, cancellations, and return rates
        const thisMonthUserCount = await User.countDocuments({
            createdAt: { $gte: startOfThisMonth }
        });
        const lastMonthUserCount = await User.countDocuments({
            createdAt: { $gte: startOfLastMonth, $lt: startOfThisMonth }
        });

        const thisMonthCampaignCount = await Campaign.countDocuments({
            createdAt: { $gte: startOfThisMonth }
        });
        const lastMonthCampaignCount = await Campaign.countDocuments({
            createdAt: { $gte: startOfLastMonth, $lt: startOfThisMonth }
        });

        const thisMonthCanceledCampaignCount = await Campaign.countDocuments({
            status: 'cancelled',
            updatedAt: { $gte: startOfThisMonth }
        });
        const lastMonthCanceledCampaignCount = await Campaign.countDocuments({
            status: 'cancelled',
            updatedAt: { $gte: startOfLastMonth, $lt: startOfThisMonth }
        });

        const thisMonthReturningUsersCount = await getReturningUsersCount(startOfThisMonth, now);
        const lastMonthReturningUsersCount = await getReturningUsersCount(startOfLastMonth, startOfThisMonth);

        res.status(200).json({
            totalUsers: {
                thisMonth: thisMonthUserCount,
                lastMonth: lastMonthUserCount
            },
            campaigns: {
                created: {
                    thisMonth: thisMonthCampaignCount,
                    lastMonth: lastMonthCampaignCount
                }
            },
            cancellations: {
                thisMonth: thisMonthCanceledCampaignCount,
                lastMonth: lastMonthCanceledCampaignCount
            },
            returnRate: {
                thisMonth: thisMonthReturningUsersCount,
                lastMonth: lastMonthReturningUsersCount
            }
        });
    } catch (error) {
        console.error('Error fetching monthly stats:', error);
        res.status(500).json({ message: error.message });
    }
}

async function getReturningUsersCount(startDate, endDate) {
    // Find all businesses with campaigns in the given date range
    const businessesWithCampaignsThisMonth = await Campaign.distinct('business', {
        'dateSchedule.startDate': { $gte: startDate, $lt: endDate }
    });

    // Find all these businesses that also have campaigns before the given date range
    const returningUsers = await User.countDocuments({
        businesses: { $in: businessesWithCampaignsThisMonth },
        _id: { $in: (await Campaign.find({
            'dateSchedule.startDate': { $lt: startDate },
            business: { $in: businessesWithCampaignsThisMonth }
        }).distinct('business')) }
    });

    return returningUsers;
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
    getMonthlyStats
};