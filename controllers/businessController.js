const User = require('../models/users');
const Business = require('../models/business');
const multer = require('multer');
const path = require('path');

// Set up Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Change this to your desired upload directory
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
    fileFilter: function (req, file, cb) {
        // Accept only specific file types
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images are allowed'));
    }
}).fields([
    { name: 'gallery', maxCount: 10 }, // Adjust maxCount as needed
    { name: 'removeGalleryItems' }
]);

const planLimits = {
    basic: 1,
    standard: 3,
    pro: 10,
};

async function addBusiness(req, res) {
    const { name, phone, location, targetMapArea, description } = req.body;
    const userId = req.user._id; // Ensure `req.user` has the `_id` property

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const allowedBusinessCount = planLimits[user.subscription.plan] || 0; // Default to 0 if no plan set
        if (user.businesses.length >= allowedBusinessCount) {
            return res.status(400).json({ message: 'Business limit reached for your subscription plan' });
        }

        // Handle file uploads
        const gallery = req.files.gallery ? req.files.gallery.map(file => file.path) : [];
        const logo = req.files.logo ? req.files.logo[0].path : '';

        const newBusiness = new Business({
            name,
            phone,
            location,
            targetMapArea,
            description,
            gallery,
            logo,
            owner: userId,
            status: 'pending', // Set status to pending on creation
        });

        const savedBusiness = await newBusiness.save();
        user.businesses.push(savedBusiness._id);
        await user.save();

        res.status(201).json({ message: 'Business added successfully', business: savedBusiness });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function getUserBusinesses(req, res) {
    const userId = req.user._id; // Ensure `req.user` has the `_id` property

    try {
        const user = await User.findById(userId).populate('businesses');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ businesses: user.businesses });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function selectSubscriptionPlan(req, res) {
    const { plan } = req.body;
    const userId = req.user._id; // Ensure `req.user` has the `_id` property

    if (!['basic', 'standard', 'pro'].includes(plan)) {
        return res.status(400).json({ message: 'Invalid subscription plan' });
    }

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.subscription.plan = plan;
        user.subscription.startDate = Date.now();
        await user.save();

        res.status(200).json({ message: 'Subscription plan selected successfully', subscription: user.subscription });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}
async function editBusiness(req, res) {
    const { businessId, name, phone, location, targetMapArea, description, removeGalleryItems } = req.body;
    const userId = req.user._id; // Ensure `req.user` has the `_id` property

    try {
        const business = await Business.findById(businessId);

        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        if (business.owner.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'You are not authorized to edit this business' });
        }

        // Update business fields
        if (name) business.name = name;
        if (phone) business.phone = phone;
        if (location) business.location = location;
        if (targetMapArea) business.targetMapArea = targetMapArea;
        if (description) business.description = description;

        // Remove gallery items
        if (removeGalleryItems && Array.isArray(removeGalleryItems)) {
            business.gallery = business.gallery.filter(item => !removeGalleryItems.includes(item));
        }

        // Add new gallery items
        if (req.files && req.files.gallery) {
            const newGalleryItems = req.files.gallery.map(file => file.path);
            business.gallery.push(...newGalleryItems);
        }

        await business.save();

        res.status(200).json({ message: 'Business updated successfully', business });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    addBusiness: [upload, addBusiness],
    getUserBusinesses,
    selectSubscriptionPlan,
    editBusiness: [upload, editBusiness]
};