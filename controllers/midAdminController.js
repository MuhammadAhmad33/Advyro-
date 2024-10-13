const { BlobServiceClient } = require('@azure/storage-blob');
const User = require('../models/users');
const Business = require('../models/business');
const Campaign = require('../models/campaigns');
const ManagementRequest = require('../models/managementReq'); 
const CustomDesignRequest = require('../models/designRequest');
const multer = require('multer');
const path = require('path');
const AdBannerDesign = require('../models/designs');
const config = require('../config/config')
const mongoose = require('mongoose');

// Azure Blob Storage setup
const blobServiceClient = BlobServiceClient.fromConnectionString(config.AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(config.AZURE_CONTAINER_NAME);

// Set up Multer for file uploads
const storage = multer.memoryStorage(); // or diskStorage depending on your setup
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size (e.g., 10MB)
}).array('designs', 10); // Handle up to 10 files, field name is 'designs'


async function uploadToAzureBlob(fileBuffer, fileName) {
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    await blockBlobClient.uploadData(fileBuffer);
    return blockBlobClient.url;
}


async function uploadDesign(req, res) {
    const userId = req.user._id;
    let businessId = req.query.businessId || '';  // Default to an empty string if not provided

    try {
        const user = await User.findById(userId);
        if (user.role !== 'mid admin') {
            return res.status(403).json({ message: 'You are not authorized to upload designs' });
        }

        // Validate businessId if provided (and not an empty string)
        if (businessId.trim() !== '') {
            if (!mongoose.Types.ObjectId.isValid(businessId)) {
                return res.status(400).json({ message: 'Invalid business ID format' });
            }

            const business = await Business.findById(businessId);
            if (!business) {
                return res.status(400).json({ message: 'Business not found' });
            }
        } else {
            // Ensure businessId is always an empty string when it's not valid or not provided
            businessId = '';
        }

        // Ensure files are uploaded
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        // Handle multiple files
        const designUrls = [];
        for (const file of req.files) {
            const designUrl = await uploadToAzureBlob(file.buffer, Date.now() + path.extname(file.originalname));
            designUrls.push(designUrl);
        }

        // Save design info to the database
        const newDesigns = designUrls.map(designUrl => ({
            fileUrl: designUrl,
            uploadedBy: userId,
            businessId: businessId  // Ensure it's saved as an empty string if not provided
        }));

        const savedDesigns = await AdBannerDesign.insertMany(newDesigns);

        res.status(201).json({ message: 'Designs uploaded successfully', designs: savedDesigns });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


async function changeBusinessStatus(req, res) {
    const { businessId, status, rejectionReason } = req.body;
    const midAdminId = req.user._id;

    try {
        // Check if the user is a mid admin
        const user = await User.findById(midAdminId);
        if (!user || user.role !== 'mid admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Find the business by ID
        const business = await Business.findById(businessId);
        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        // Validate the status
        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        // Update the business status and related fields
        business.status = status;
        business.statusChangedBy = midAdminId; // Set the mid-admin who changed the status

        if (status === 'rejected' && rejectionReason) {
            business.rejectionReason = rejectionReason;
        } else {
            business.rejectionReason = undefined; // Clear the rejection reason if not rejected
        }

        await business.save();

        // Populate the statusChangedBy and managedBy fields with user's name and email
        const updatedBusiness = await Business.findById(businessId)
            .populate('statusChangedBy', 'fullname email')
        res.status(200).json({
            message: `Business ${status} successfully`,
            business: updatedBusiness,
        });
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
        campaign.statusChangedBy = userId; // Set the mid-admin who changed the status
        if (status === 'rejected' && rejectionReason) {
            campaign.rejectionReason = rejectionReason;
        } else {
            campaign.rejectionReason = undefined; // Clear the rejection reason if not rejected
        }
        await campaign.save();

        // Populate the statusChangedBy field with the user's name
        const updatedCampaign = await Campaign.findById(campaignId)
        .populate('statusChangedBy', 'fullname email');

        res.status(200).json({ message: `Campaign ${status} successfully`, campaign: updatedCampaign });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


// Function to get all design requests
const mongoose = require('mongoose');
const User = require('../models/User'); // Assuming the User model is in ../models/User

async function getAllDesignRequests(req, res) {
    try {
        const userId = req.params.userId;

        // Validation: Check if userId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: "Invalid userId provided" });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Fetch only the approved design requests, where the business is managed by the userId
        const requests = await CustomDesignRequest.find({
            status: 'accepted', // Filter by approved requests only
            business: { $ne: null } // Ensure the request has a business attached
        })
        .populate({
            path: 'user',
            select: 'fullname email',
            match: { _id: { $ne: null } } // Ensure populated user is not null
        })
        .populate({
            path: 'business',
            match: {
                managedBy: userId, // Filter businesses managed by the current user
                _id: { $ne: null } // Ensure populated business is not null
            }
        });

        // Filter out requests where business is still null after populate (i.e., not managed by this user)
        const filteredRequests = requests.filter(
            (request) => request.business !== null // Keep only requests with businesses managed by this user
        );

        // Return the filtered list of design requests
        res.status(200).json(filteredRequests);
    } catch (error) {
        console.error('Error fetching design requests:', error);
        res.status(500).json({ message: error.message });
    }
}


// Function to update the status of a design request
async function updateDesignRequestStatus(req, res) {
        const { requestId } = req.params;
        const { status, response } = req.body;
        const userId = req.user._id; // Assuming `req.user.id` contains the ID of the logged-in user
    
        try {
            const request = await CustomDesignRequest.findById(requestId);
            if (!request) {
                return res.status(404).json({ message: 'Request not found' });
            }
    
            // Update the status, response, and the user who changed the status
            request.status = status;
            request.response = response;
            request.statusChangedBy = userId;
    
            await request.save();
    
            // Populate the statusChangedBy field with user's full name and email
            const updatedRequest = await CustomDesignRequest.findById(requestId)
                .populate('statusChangedBy', 'fullName email');
    
            res.status(200).json({
                message: 'Request updated successfully',
                request: updatedRequest,
            });
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
            select: 'name email _id', // Ensure both email and _id are selected
        });

        // Filter out businesses where owner is null or missing _id or email
        const validBusinesses = businesses.filter(business => {
            const owner = business.owner;
            return owner && owner._id && owner.email;
        });

        // Fetch campaigns for each valid business
        const businessesWithCampaigns = await Promise.all(
            validBusinesses.map(async (business) => {
                const campaigns = await Campaign.find({ business: business._id });
                return {
                    business,
                    campaigns,
                };
            })
        );

        // Return filtered businesses with their campaigns
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
            select: 'name email _id', // Ensure both email and _id are selected
        });

        // Filter out businesses where owner is null or missing _id or email
        const validBusinesses = businesses.filter(business => {
            const owner = business.owner;
            return owner && owner._id && owner.email;
        });

        // Return businesses filtered by status and valid owner
        res.status(200).json({ businesses: validBusinesses });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


async function getCampaignsByStatus(req, res) {
    const { status } = req.params; // 'pending', 'approved', 'rejected'

    try {
        // Fetch campaigns based on status and populate business and user details from the business reference
        const campaigns = await Campaign.find({ status })
            .populate({
                path: 'business',
                select: 'name location owner',
                populate: {
                    path: 'owner',
                    select: 'fullname email',
                },
            });

        // Filter out campaigns where business or any of its fields are null
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

        if (filteredCampaigns.length === 0) {
            return res.status(404).json({ message: 'No valid campaigns found for the given status' });
        }

        res.status(200).json({ campaigns: filteredCampaigns });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}



// Function to add analytics data to a campaign
async function addAnalyticsData(req, res) {
    const { campaignId } = req.params;
    const { date, impressions, clicks } = req.body;
    const userId = req.user._id; // Assuming the user ID is available in the request (e.g., through authentication middleware)

    try {
        // Find the campaign by ID
        const campaign = await Campaign.findById(campaignId);

        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }

        // Add new analytics data with the user who added it
        campaign.analytics.push({ date, impressions, clicks, addedBy: userId });

        // Save the updated campaign
        const updatedCampaign = await campaign.save();

        res.status(200).json({ message: 'Analytics data added successfully', campaign: updatedCampaign });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Controller function to get the 10 most recent businesses
async function getRecentBusinesses(req, res) {
    try {
        const recentBusinesses = await Business.find()
            .sort({ createdAt: -1 }) // Sort by createdAt field in descending order
            .limit(10); // Limit the results to 10

        // Filter out businesses where owner is null
        const filteredBusinesses = recentBusinesses.filter(business => business.owner !== null);

        return res.status(200).json(filteredBusinesses);
    } catch (error) {
        console.error('Error fetching recent businesses:', error);
        return res.status(500).json({ message: 'Error fetching recent businesses', error: error.message });
    }
}


async function requestBusinessManagement(req, res) {
    const { businessId } = req.body; // Expecting business ID in the request body
    const midAdminId = req.user._id; // Assuming req.user contains the authenticated user's data

    try {
        // Check if the user is a mid admin
        const user = await User.findById(midAdminId);
        if (!user || user.role !== 'mid admin') {
            return res.status(403).json({ message: 'Forbidden: Only mid admins can request business management' });
        }

        // Check if the business exists
        const business = await Business.findById(businessId);
        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        // Create a new management request
        const request = new ManagementRequest({
            midAdmin: midAdminId,
            business: businessId,
        });

        await request.save();
        return res.status(201).json({ message: 'Management request submitted successfully', request });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {
    changeBusinessStatus,
    updateCampaignStatus,
    getAllDesignRequests,
    updateDesignRequestStatus,
    getAllBusinessesWithCampaigns,
    getBusinessesByStatus,
    getCampaignsByStatus,
    addAnalyticsData,
    getRecentBusinesses,
    requestBusinessManagement,
    uploadDesign:[upload,uploadDesign]
};
