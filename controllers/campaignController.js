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
    const userId = req.user._id; // User ID from request (Ensure `req.user` has the `_id` property)
    const { status } = req.params; // The status parameter (e.g., 'pending', 'approved', 'rejected')

    try {
        // Step 1: Find all businesses where the user is the owner
        const businesses = await Business.find({ owner: userId });

        if (businesses.length === 0) {
            return res.status(404).json({ message: 'No businesses found for the user' });
        }

        // Step 2: Extract business IDs
        const businessIds = businesses.map(business => business._id);

        // Step 3: Find all campaigns where the business belongs to the user and the status matches
        const campaigns = await Campaign.find({ business: { $in: businessIds }, status })
            .populate({
                path: 'business',
                select: 'name location owner',
                populate: {
                    path: 'owner',
                    select: 'fullname email',
                },
            });

        // Step 4: Filter out invalid campaigns where business or required fields are missing
        const filteredCampaigns = campaigns.filter(campaign => {
            const business = campaign.business;
            return (
                business && 
                business._id && 
                business.name && 
                business.location && 
                business.owner && 
                business.owner._id && 
                business.owner.fullname && 
                business.owner.email
            );
        });

        // If no valid campaigns found
        if (filteredCampaigns.length === 0) {
            return res.status(404).json({ message: 'No valid campaigns found for the given status' });
        }

        // Return the filtered campaigns
        res.status(200).json({ campaigns: filteredCampaigns });
    } catch (error) {
        // Handle any errors that occur during the query
        res.status(500).json({ message: error.message });
    }
}

async function getAllDesigns(req, res) {
    try {
        // Get businessId from the request parameters or query
        const { businessId } = req.params; // Extract businessId from route parameters

        // Retrieve all design records from the database
        const designs = await AdBannerDesign.find()
            .populate('uploadedBy', 'fullname email') // Populate the uploader's details
            .populate('likes', 'fullname email') // Populate user details for likes
            .populate('dislikes', 'fullname email') // Populate user details for dislikes
            .lean();

        // Filter out designs where 'uploadedBy' is null or undefined
        const filteredDesigns = designs.filter(design => design.uploadedBy !== null && design.uploadedBy !== undefined);

        // Format each design with user details, counts for likes and dislikes
        const designsWithCounts = filteredDesigns.map(design => ({
            ...design,
            comment: design.comment || "", // Include the comment field, default to empty string if undefined
            businessId: design.businessId ? design.businessId : "", // Set business to an empty string if null
            likeCount: (design.likes && design.likes.length) || 0,
            dislikeCount: (design.dislikes && design.dislikes.length) || 0,
            likedByUsers: design.likes ? design.likes.map(user => ({ fullname: user.fullname, email: user.email })) : [],
            dislikedByUsers: design.dislikes ? design.dislikes.map(user => ({ fullname: user.fullname, email: user.email })) : [],
        }));

        // Filter designs based on the provided businessId
        const resultDesigns = designsWithCounts.filter(design => 
            businessId === "" || design.businessId === businessId
        );

        res.status(200).json({ designs: resultDesigns });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Edit Design with Comment API
async function editDesign(req, res) {
    console.log(`Edit Design`);

    const { businessId, designId, comment } = req.body;

    // Validate that required fields are provided
    if (!businessId) {
        return res.status(400).json({ message: 'Business ID is required' });
    }

    if (!designId) {
        return res.status(400).json({ message: 'Design ID is required' });
    }

    // Comment can be an empty string or a valid string
    if (comment !== undefined && typeof comment !== 'string') {
        return res.status(400).json({ message: 'Comment must be a string' });
    }

    try {
        // Check if business exists
        const business = await Business.findById(businessId);
        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        // Check if design exists
        const design = await AdBannerDesign.findById(designId);
        if (!design) {
            return res.status(404).json({ message: 'Design not found' });
        }

        // Update the comment field (even if it's an empty string)
        design.comment = comment || ""; // Default to empty string if undefined

        // Save the updated design
        const updatedDesign = await design.save();

        // Return the updated design, including the comment field
        res.status(200).json({
            message: 'Design Update Send',
            design: {
                _id: updatedDesign._id,
                fileUrl: updatedDesign.fileUrl,
                uploadedBy: updatedDesign.uploadedBy,
                businessId: updatedDesign.businessId,
                likes: updatedDesign.likes,
                dislikes: updatedDesign.dislikes,
                uploadDate: updatedDesign.uploadDate,
                comment: updatedDesign.comment,  // Include comment in the response
            },
        });
    } catch (error) {
        console.error('Error updating design:', error);
        res.status(500).json({ message: error.message });
    }
}

async function deleteInvalidAdBannerDesigns(req, res) {

    try {

        // Get all AdBannerDesigns
        const designs = await AdBannerDesign.find();

        // Filter designs where businessId is an empty string
        const designsToDelete = designs.filter(design => 
            design.businessId === "" || !design.businessId
        );

        // If no designs to delete, return a message
        if (designsToDelete.length === 0) {
            return res.status(200).json({ message: 'No invalid Ad Banner Designs found to delete.' });
        }

        // Extract the IDs of the designs to delete
        const idsToDelete = designsToDelete.map(design => design._id);

        // Delete the AdBannerDesign documents
        const result = await AdBannerDesign.deleteMany({
            _id: { $in: idsToDelete }
        });

        res.status(200).json({
            message: `${result.deletedCount} invalid Ad Banner Designs deleted successfully.`,
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

async function deleteInvalidCampaigns(req, res) {
    try {
        // Delete campaigns where the 'business' field is null or an empty string
        const result = await Campaign.deleteMany({
            $or: [
                { business: null }, // Business is null
                { business: "" }    // Business is an empty string
            ]
        });

        res.status(200).json({
            message: `${result.deletedCount} invalid campaigns deleted successfully.`,
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
