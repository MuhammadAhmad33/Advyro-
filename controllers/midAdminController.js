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


// Function to handle design upload
async function uploadDesign(req, res) {
    const userId = req.user._id; // Ensure `req.user` has the `_id` property

    try {
        // Check if user is a mid admin
        const user = await User.findById(userId);
        if (user.role !== 'mid admin') {
            return res.status(403).json({ message: 'You are not authorized to upload designs' });
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
            uploadedBy: userId
        }));

        const savedDesigns = await AdBannerDesign.insertMany(newDesigns);

        res.status(201).json({ message: 'Designs uploaded successfully', designs: savedDesigns });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

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
        business.statusChangedBy = midAdminId; // Set the mid-admin who changed the status
        if (status === 'rejected' && rejectionReason) {
            business.rejectionReason = rejectionReason;
        } else {
            business.rejectionReason = undefined; // Clear the rejection reason if not rejected
        }
        await business.save();

        // Populate the statusChangedBy field with the user's name
        const updatedBusiness = await Business.findById(businessId);

        res.status(200).json({ message: `Business ${status} successfully`, business: updatedBusiness });
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
        const updatedCampaign = await Campaign.findById(campaignId);

        res.status(200).json({ message: `Campaign ${status} successfully`, campaign: updatedCampaign });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


// Function to get all design requests
async function getAllDesignRequests(req, res) {
    try {
        const requests = await CustomDesignRequest.find()
            .populate('user', 'fullname email') // Populate user details
            .populate('business') // Populate complete business details

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
// Controller function to get the 10 most recent businesses
async function getRecentBusinesses(req, res){
    try {
      const recentBusinesses = await Business.find()
        .sort({ createdAt: -1 }) // Sort by createdAt field in descending order
        .limit(10); // Limit the results to 10
  
      return res.status(200).json(recentBusinesses);
    } catch (error) {
      console.error('Error fetching recent businesses:', error);
      return res.status(500).json({ message: 'Error fetching recent businesses', error: error.message });
    }
};

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
