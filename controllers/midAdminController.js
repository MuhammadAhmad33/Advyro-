const User = require('../models/users');
const Business = require('../models/business');
const Campaign = require('../models/campaigns');

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

module.exports = {
    changeBusinessStatus,
    updateCampaignStatus,
};
