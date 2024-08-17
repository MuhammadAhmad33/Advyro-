const { BlobServiceClient } = require('@azure/storage-blob');
const Campaign = require('../models/campaigns');
const Business = require('../models/business');
const User = require('../models/users');
const AdBannerDesign=require('../models/designs')
const CustomDesignRequest = require('../models/designRequest');
const multer = require('multer');
const path = require('path');
const config=require('../config/config')

// Azure Blob Storage setup
const blobServiceClient = BlobServiceClient.fromConnectionString(config.AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(config.AZURE_CONTAINER_NAME);

// Multer setup to store files in memory
const storage = multer.memoryStorage(); 
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images are allowed'));
    }
}).single('adBanner'); // Adjust the field name as per your form

async function uploadToAzureBlob(fileBuffer, fileName) {
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    await blockBlobClient.uploadData(fileBuffer);
    return blockBlobClient.url;
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

        let adBannerUrl = null;
        if (req.file) {
            const fileName = `${Date.now()}${path.extname(req.file.originalname)}`;
            adBannerUrl = await uploadToAzureBlob(req.file.buffer, fileName);
        }

        const newCampaign = new Campaign({
            adBanner: adBannerUrl,
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
        });

        const savedCampaign = await newCampaign.save();

        // Fetch user's coin balance
        const user = await User.findById(userId);
        const coinBalance = user.coinBalance;

        res.status(201).json({
            message: 'Campaign created successfully. Please proceed to payment.',
            campaign: savedCampaign,
            coinBalance: coinBalance,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


async function payCampaignFee(req, res) {
    
    const userId = req.user._id;
    console.log(req.body)

    try {
        const user = await User.findById(userId);
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

            return res.status(200).json({
                message: 'Campaign fee paid successfully with coins',
                newCoinBalance: user.coinBalance,
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

async function getAllDesigns(req, res) {
    try {
        // Retrieve all design records from the database
        const designs = await AdBannerDesign.find().populate('uploadedBy', 'fullname email'); // Populate user details

        res.status(200).json({ designs });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    createCampaign: [upload, createCampaign],
    getCampaigns,
    requestMoreDesigns,
    payCampaignFee,
    cancelCampaign,
    getCampaignsByStatus,
    getAllDesigns
};
