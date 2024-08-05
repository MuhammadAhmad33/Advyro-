const Campaign = require('../models/campaigns');
const Business = require('../models/business');
const User = require('../models/users');
const CustomDesignRequest = require('../models/designRequest');
const multer = require('multer');
const path = require('path');
const moment = require('moment');

// Set up Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Change this to your desired upload directory
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ storage: storage });

function isValidDuration(startTime, endTime) {
    const start = moment(startTime, "HH:mm");
    const end = moment(endTime, "HH:mm");

    // Check if the end time is before the start time (next day scenario)
    if (end.isBefore(start)) {
        end.add(1, 'day');
    }

    const duration = moment.duration(end.diff(start)).asHours();
    return duration >= 8;
}

async function createCampaign(req, res) {
    const { businessId, adsName, campaignDesc, campaignPlatforms, startDate, endDate, startTime, endTime } = req.body;
    const userId = req.user._id;

    try {
        const business = await Business.findById(businessId);

        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        if (business.owner.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'You are not authorized to create a campaign for this business' });
        }

        if (!isValidDuration(startTime, endTime)) {
            return res.status(400).json({ message: 'Time duration must be at least 8 hours' });
        }

        const adBanner = req.file ? req.file.path : null;

        const newCampaign = new Campaign({
            adBanner,
            business: businessId,
            adsName,
            campaignDesc,
            campaignPlatforms,
            dateSchedule: {
                startDate,
                endDate,
            },
            startTime,
            endTime,
            status: 'pending', // Set initial status to pending
            feePaid: false // Set initial feePaid to false
        });

        const savedCampaign = await newCampaign.save();

        // Fetch user's coin balance
        const user = await User.findById(userId);
        const coinBalance = user.coinBalance;
        const campaignFee = 1200; // Campaign fee in coins

        res.status(201).json({
            message: 'Campaign created successfully. Please proceed to payment.',
            campaign: savedCampaign,
            coinBalance: coinBalance,
            campaignFee: campaignFee,
            paymentRequired: true
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function payCampaignFee(req, res) {
    const { campaignId } = req.body;
    const userId = req.user._id;
    console.log(req.body)

    try {
        const user = await User.findById(userId);
        const campaign = await Campaign.findById(campaignId).populate('business');

        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }

        if (campaign.business.owner.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'You are not authorized to pay for this campaign' });
        }

        const campaignFee = 1200; // Campaign fee in coins

        if (user.coinBalance < campaignFee) {

            return res.status(200).json({
                message: 'Insufficient coins. Please Recharge.',
                coinShortage: campaignFee - user.coinBalance
            });
        } else {
            // If user has enough coins, deduct from balance and activate campaign
            user.coinBalance -= campaignFee;
            await user.save();

            campaign.status = 'active';
            campaign.feePaid = true;
            await campaign.save();

            return res.status(200).json({
                message: 'Campaign fee paid successfully with coins',
                newCoinBalance: user.coinBalance,
                campaignStatus: campaign.status
            });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


async function getCampaigns(req, res) {
    const businessId = req.params.businessId;

    try {
        const campaigns = await Campaign.find({ business: businessId });

        if (!campaigns) {
            return res.status(404).json({ message: 'No campaigns found for this business' });
        }

        res.status(200).json({ campaigns });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function requestMoreDesigns(req, res) {
    const { description } = req.body;
    const userId = req.user._id;

    try {
        const newRequest = new CustomDesignRequest({
            user: userId,
            description,
            status: 'pending', // Initial status set to pending
        });

        const savedRequest = await newRequest.save();
        res.status(201).json({ message: 'Design request submitted successfully', request: savedRequest });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function cancelCampaign(req, res) {
    const { campaignId } = req.body; // No need for cancellation reason
    const userId = req.user._id; // Ensure `req.user` has the `_id` property

    try {
        const campaign = await Campaign.findById(campaignId).populate('business');

        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }

        if (campaign.business.owner.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'You are not authorized to cancel this campaign' });
        }

        // Change the status to 'cancelled'
        campaign.status = 'cancelled';

        await campaign.save();

        res.status(200).json({ 
            message: 'Campaign cancelled successfully', 
            campaign 
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function getCampaignsByStatus(req, res) {
    const userId = req.user._id; // Ensure `req.user` has the `_id` property
    const now = new Date();

    try {
        // Find previous pending campaigns
        const previousPendingCampaigns = await Campaign.find({
            owner: userId,
            status: 'pending',
            'dateSchedule.endDate': { $lt: now }
        });

        // Find current active campaigns
        const currentActiveCampaigns = await Campaign.find({
            owner: userId,
            status: 'active',
            'dateSchedule.startDate': { $lte: now },
            'dateSchedule.endDate': { $gte: now }
        });

        res.status(200).json({
            previousPendingCampaigns,
            currentActiveCampaigns
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    createCampaign: [upload.single('adBanner'), createCampaign],
    getCampaigns,
    requestMoreDesigns,
    payCampaignFee,
    cancelCampaign,
    getCampaignsByStatus
};
