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
    const { businessId, adsName, websiteUrl, campaignDesc, campaignPlatforms, startDate, endDate, startTime, endTime } = req.body;
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
            websiteUrl,
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

        res.status(201).json({ message: 'Campaign created successfully', campaign: savedCampaign });
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


module.exports = {
    createCampaign: [upload.single('adBanner'), createCampaign],
    getCampaigns,
    requestMoreDesigns 
};
