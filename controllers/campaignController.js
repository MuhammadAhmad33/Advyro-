const { BlobServiceClient } = require('@azure/storage-blob');
const Campaign = require('../models/campaigns');
const Business = require('../models/business');
const User = require('../models/users');
const AdBannerDesign=require('../models/designs')
const CustomDesignRequest = require('../models/designRequest');
const multer = require('multer');
const path = require('path');
const config=require('../config/config')
const Wallet = require('../models/wallet');
const Transaction = require('../models/transaction');

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
    const { businessId, adsName, campaignDesc, campaignPlatforms, startDate, endDate, startTime, endTime, cost } = req.body;
    const userId = req.user._id;

    try {
        // Check if the cost is provided and valid
        if (!cost || isNaN(cost) || cost <= 0) {
            return res.status(400).json({ message: 'Invalid or missing campaign cost. Cost must be a positive number.' });
        }

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

        // Create a new campaign object including the cost
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
            cost, // Add cost to the campaign
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

        // Filter out campaigns where business is null
        const filteredCampaigns = campaigns.filter(campaign => campaign.business !== null);

        if (filteredCampaigns.length === 0) {
            return res.status(404).json({ message: 'No campaigns found for this business' });
        }

        res.status(200).json({ campaigns: filteredCampaigns });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function requestMoreDesigns(req, res) {
    const { description, businessId } = req.body;
    const userId = req.user._id;

    try {
        // Validate that the business and campaign exist
        const business = await Business.findById(businessId);

        if (!business) {
            return res.status(400).json({ message: 'Invalid business ID' });
        }

        const newRequest = new CustomDesignRequest({
            user: userId,
            description,
            business: businessId,
            status: 'pending', // Initial status set to pending
        });

        const savedRequest = await newRequest.save();
        res.status(201).json({ message: 'Design request submitted successfully', request: savedRequest });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function cancelCampaign(req, res) {
    const { campaignId } = req.body;
    const userId = req.user._id;

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

        // Refund logic
        const refundAmount = campaign.cost; // Assuming `cost` is a field in your campaign model
        const wallet = await Wallet.findOne({ user_id: userId });

        if (!wallet) {
            // Create a new wallet if it doesn't exist
            const newWallet = new Wallet({
                user_id: userId,
                balance: refundAmount,
                last_updated: Date.now(),
            });
            await newWallet.save();
        } else {
            // Add the refund amount to the existing wallet
            wallet.balance += refundAmount;
            wallet.last_updated = Date.now();
            await wallet.save();
        }

        // Create a refund transaction
        const transaction = new Transaction({
            user_id: userId,
            type: 'payment', // Type is payment since it’s a refund
            amount: refundAmount,
            status: 'completed',
            created_at: Date.now(),
        });
        await transaction.save();

        res.status(200).json({
            message: 'Campaign cancelled successfully, and refund processed',
            campaign,
            refundAmount,
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
        const designs = await AdBannerDesign.find()
            .populate('uploadedBy', 'fullname email') // Populate the uploader's details
            .populate('likes', 'fullname email') // Populate user details for likes
            .populate('dislikes', 'fullname email') // Populate user details for dislikes
            .lean();

        // Format each design with user details, counts for likes and dislikes,
        // and set business to an empty string if it's null
        const designsWithCounts = designs.map(design => ({
            ...design,
            businessId: design.businessId ? design.businessId : "", // Set business to an empty string if null
            likeCount: (design.likes && design.likes.length) || 0,
            dislikeCount: (design.dislikes && design.dislikes.length) || 0,
            likedByUsers: design.likes ? design.likes.map(user => ({ fullname: user.fullname, email: user.email })) : [],
            dislikedByUsers: design.dislikes ? design.dislikes.map(user => ({ fullname: user.fullname, email: user.email })) : [],
        }));

        res.status(200).json({ designs: designsWithCounts });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Edit Design with Comment API
async function editDesign(req, res) {
    console.log(`Edit Design`);
    const { businessId, designId, comment } = req.body;  // Business ID and Design ID from request body

    try {
        // Validate that the business exists and belongs to the user
        const business = await Business.findById(businessId);
        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        // Find the design by designId
        const tempDesign = await AdBannerDesign.findById(designId);
        if (!tempDesign) {
            return res.status(404).json({ message: 'Design not found' });
        }

        // Here, you can add the logic for editing the design
        // For example, if you want to add a comment, you can update the design object
        tempDesign.comment = comment;  // Assuming a comment field is added in the model

        // Save the updated design
        const design = await tempDesign.save();

        res.status(200).json({
            message: 'Design Update Send',
            design,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function deleteAllCampaigns(req, res) {
    const userId = req.user._id; // Ensure `req.user` has the `_id` property

    try {
        // Check if the user is authorized to delete campaigns
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Delete all campaigns
        const result = await Campaign.deleteMany({}); // This will delete all campaigns

        res.status(200).json({
            message: `${result.deletedCount} campaigns deleted successfully.`,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function likeDesign(req, res) {
    const userId = req.user._id;
    const { designId } = req.params;

    try {
        const design = await AdBannerDesign.findById(designId);
        if (!design) {
            return res.status(404).json({ message: 'Design not found' });
        }

        // Remove dislike if it exists
        design.dislikes.pull(userId);
        // Add user to likes if not already liked
        if (!design.likes.includes(userId)) {
            design.likes.push(userId);
        }

        await design.save();
        res.status(200).json({ message: 'Design liked', design });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function dislikeDesign(req, res) {
    const userId = req.user._id;
    const { designId } = req.params;

    try {
        const design = await AdBannerDesign.findById(designId);
        if (!design) {
            return res.status(404).json({ message: 'Design not found' });
        }

        // Remove like if it exists
        design.likes.pull(userId);
        // Add user to dislikes if not already disliked
        if (!design.dislikes.includes(userId)) {
            design.dislikes.push(userId);
        }

        await design.save();
        res.status(200).json({ message: 'Design disliked', design });
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
    getAllDesigns,
    deleteAllCampaigns,
    likeDesign,
    dislikeDesign,
    editDesign
};
