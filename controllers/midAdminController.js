const User = require('../models/users');
const Business = require('../models/business');
const Campaign = require('../models/campaigns');
const CustomDesignRequest = require('../models/designRequest');


async function changeBusinessStatus(req, res) {
    const { businessId, status, rejectionReason } = req.body;
    const midAdminId = req.user.id;

    try {
        const user = await User.findById(midAdminId);
        if (!user || user.role !== 'mid admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const business = await Business.findById(businessId);
        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        business.status = status;
        if (status === 'rejected' && rejectionReason) {
            business.rejectionReason = rejectionReason;
        } else {
            business.rejectionReason = undefined; // Clear the rejection reason if not rejected
        }
        await business.save();

        res.status(200).json({ message: `Business ${status} successfully` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function updateCampaignStatus(req, res) {
    const { campaignId, status, rejectionReason } = req.body;
    const userId = req.user._id;

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    try {
        const user = await User.findById(userId);
        if (user.role !== 'mid admin') {
            return res.status(403).json({ message: 'You are not authorized to update campaign status' });
        }

        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }

        campaign.status = status;
        if (status === 'rejected' && rejectionReason) {
            campaign.rejectionReason = rejectionReason;
        } else {
            campaign.rejectionReason = undefined; // Clear the rejection reason if not rejected
        }
        await campaign.save();

        res.status(200).json({ message: `Campaign ${status} successfully`, campaign });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


// Function to get all design requests
async function getAllDesignRequests(req, res) {
    try {
        const requests = await CustomDesignRequest.find().populate('user', 'fullname email');
        res.status(200).json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Function to update the status of a design request
async function updateDesignRequestStatus(req, res) {
    const { requestId } = req.params;
    const { status, response } = req.body;

    try {
        const request = await CustomDesignRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        request.status = status;
        request.response = response;
        await request.save();

        res.status(200).json({ message: 'Request updated successfully', request });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Function to get all businesses with their respective campaigns
async function getAllBusinessesWithCampaigns(req, res) {
    try {
        // Find all businesses and populate owner details
        const businesses = await Business.find().populate({
            path: 'owner',
            select: 'name email', // Select specific fields from owner
        });

        // Fetch campaigns for each business
        const businessesWithCampaigns = await Promise.all(
            businesses.map(async (business) => {
                const campaigns = await Campaign.find({ business: business._id });
                return {
                    business,
                    campaigns,
                };
            })
        );

        // Return businesses with their campaigns
        res.status(200).json({ businesses: businessesWithCampaigns });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Function to get businesses based on status
async function getBusinessesByStatus(req, res) {
    const { status } = req.params; // 'pending', 'accepted', 'rejected'

    try {
        // Fetch businesses based on status and populate owner details
        const businesses = await Business.find({ status }).populate({
            path: 'owner',
            select: 'name email',
        });

        // Return businesses filtered by status
        res.status(200).json({ businesses });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Function to get campaigns based on status
async function getCampaignsByStatus(req, res) {
    const { status } = req.params; // 'pending', 'approved', 'rejected'

    try {
        // Fetch campaigns based on status and populate business details
        const campaigns = await Campaign.find({ status }).populate({
            path: 'business',
            select: 'name location', // Select specific fields from business
        });

        // Return campaigns filtered by status
        res.status(200).json({ campaigns });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Function to add analytics data to a campaign
async function addAnalyticsData(req, res) {
    const { campaignId } = req.params;
    const { date, impressions, clicks } = req.body;

    try {
        // Find the campaign by ID
        const campaign = await Campaign.findById(campaignId);

        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }

        // Add new analytics data
        campaign.analytics.push({ date, impressions, clicks });

        // Save the updated campaign
        const updatedCampaign = await campaign.save();

        res.status(200).json({ message: 'Analytics data added successfully', campaign: updatedCampaign });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    changeBusinessStatus,
    updateCampaignStatus,
    getAllDesignRequests,
    updateDesignRequestStatus,
    getAllBusinessesWithCampaigns,
    getBusinessesByStatus,
    getCampaignsByStatus,
    addAnalyticsData,
};
