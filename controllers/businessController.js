const { BlobServiceClient } = require('@azure/storage-blob');
const User = require('../models/users');
const Business = require('../models/business');
const SubscriptionPlan = require('../models/subscriptionPlans');
const multer = require('multer');
const path = require('path');
const config=require('../config/config')
const stripe = require('stripe')(config.STRIPE_SECRET_KEY);

// Azure Blob Storage setup
const blobServiceClient = BlobServiceClient.fromConnectionString(config.AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(config.AZURE_CONTAINER_NAME);

// Multer setup (if you still want to process files locally before upload)
const storage = multer.memoryStorage(); // Store files in memory
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
}).fields([
    { name: 'gallery', maxCount: 10 },
    { name: 'logo', maxCount: 1 }
]);

const planLimits = {
    basic: 1,
    standard: 3,
    pro: 10,
};


async function uploadToAzureBlob(fileBuffer, fileName) {
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    await blockBlobClient.uploadData(fileBuffer);
    return blockBlobClient.url;
}

async function deleteFromAzureBlob(fileName) {

    const containerClient = blobServiceClient.getContainerClient(config.AZURE_CONTAINER_NAME);
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    await blockBlobClient.delete();
    return;
}



async function addBusiness(req, res) {
    const { 
        name, phone, location, targetMapArea, description,
        websiteUrl, facebookUrl, instagramUrl, linkedinUrl, tiktokUrl 
    } = req.body;
    const userId = req.user._id;

    try {
        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user has a subscription plan
        if (!user.subscription.plan) {
            return res.status(404).json({ message: 'Get a subscription first!' });
        }

        // Perform a case-insensitive search for the subscription plan
        const subscriptionPlan = await SubscriptionPlan.findOne({ 
            name: { $regex: new RegExp(`^${user.subscription.plan}$`, 'i') } 
        });

        if (!subscriptionPlan) {
            return res.status(404).json({ message: 'Subscription plan not found' });
        }

        // Get the business limit from the subscription plan
        const allowedBusinessCount = subscriptionPlan.businessLimit;
        if (user.businesses.length >= allowedBusinessCount) {
            return res.status(400).json({ message: 'Business limit reached for your subscription plan' });
        }

        // Handle file uploads (gallery and logo)
        const gallery = [];
        let logo = '';

        if (req.files.gallery) {
            for (const file of req.files.gallery) {
                const url = await uploadToAzureBlob(file.buffer, Date.now() + path.extname(file.originalname));
                gallery.push(url);
                console.log(url);
            }
        }

        if (req.files.logo) {
            logo = await uploadToAzureBlob(req.files.logo[0].buffer, Date.now() + path.extname(req.files.logo[0].originalname));
        }

        // Create a new business
        const newBusiness = new Business({
            name, phone, location, targetMapArea, description,
            gallery, logo, owner: userId, status: 'pending',
            websiteUrl, facebookUrl, instagramUrl, linkedinUrl, tiktokUrl
        });

        // Save the new business and update the user's business list
        const savedBusiness = await newBusiness.save();
        user.businesses.push(savedBusiness._id);
        await user.save();
        console.log(savedBusiness);

        // Respond with the newly created business
        res.status(201).json({ message: 'Business added successfully', business: savedBusiness });
    } catch (error) {
        // Handle any errors
        res.status(500).json({ message: error.message });
    }
}


async function getUserBusinesses(req, res) {
    const userId = req.user._id; // Ensure `req.user` has the `_id` property

    try {
        const user = await User.findById(userId)
            .populate({
                path: 'businesses',
                match: { owner: { $ne: null } } // Ensure only businesses with a non-null owner are returned
            });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Filter out any businesses where owner is still null
        const validBusinesses = user.businesses.filter(business => business.owner !== null);

        res.status(200).json({ businesses: validBusinesses });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const selectSubscriptionPlan = async (req, res) => {
    try {
        const { plan } = req.body;
        
        if (!plan) {
            return res.status(400).json({ error: 'Plan is required' });
        }

        const userId = req.user._id;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const subscriptionPlan = await SubscriptionPlan.findOne({ name: plan });

        if (!subscriptionPlan) {
            return res.status(400).json({ error: 'Invalid subscription plan' });
        }
        console.log(subscriptionPlan)

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `${subscriptionPlan.name} Plan`,
                    },
                    unit_amount: subscriptionPlan.price, // Convert to cents
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `http://localhost:7002/payment-success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
            cancel_url: `http://localhost:7002/payment-cancel`,
            client_reference_id: userId.toString(),
        });

        console.log('Checkout Session created:', session.id);
        res.status(200).json({ 
            sessionId: session.id,
            checkoutUrl: session.url
        });
    } catch (error) {
        console.error('Error in selectSubscriptionPlan:', error);
        res.status(500).json({ error: error.message });
    }
};

const confirmPaymentAndUpdateSubscription = async (req, res) => {
    const { plan } = req.query;

    try {
        // Find user by ID
        const user = await User.findById(req.user._id);

        if (user) {
            // Find the subscription plan (case-insensitive)
            const subscriptionPlan = await SubscriptionPlan.findOne({ name: { $regex: new RegExp(`^${plan}$`, 'i') } });

            if (!subscriptionPlan) {
                return res.status(404).json({ message: 'Subscription plan not found' });
            }

            // Check if user already has an active subscription
            if (user.subscription.plan) {
                const currentPlan = await SubscriptionPlan.findOne({ name: user.subscription.plan });
                const currentDate = Date.now();
                const currentExpiry = new Date(user.subscription.expiryDate).getTime();

                // Prevent downgrading if user tries to select a plan with a lower businessLimit
                if (subscriptionPlan.businessLimit < currentPlan.businessLimit) {
                    if (currentDate < currentExpiry) {
                        return res.status(400).json({ message: 'You cannot downgrade your plan until the current plan expires.' });
                    }
                }

                // If upgrading to a new plan (not the same as current plan)
                if (subscriptionPlan.name.toLowerCase() !== currentPlan.name.toLowerCase()) {
                    // Reset the expiry date to current time with new plan's duration
                    user.subscription.expiryDate = new Date(Date.now() + subscriptionPlan.duration * 30 * 24 * 60 * 60 * 1000);
                } else {
                    // If same plan is purchased, extend the expiry date
                    user.subscription.expiryDate = new Date(currentExpiry + subscriptionPlan.duration * 30 * 24 * 60 * 60 * 1000);
                }

            } else {
                // First-time subscription
                user.subscription.plan = plan;
                user.subscription.startDate = Date.now();
                user.subscription.expiryDate = new Date(Date.now() + subscriptionPlan.duration * 30 * 24 * 60 * 60 * 1000);
            }

            // Update the user's business limit if upgrading
            if (subscriptionPlan.businessLimit > currentPlan?.businessLimit) {
                user.subscription.businessLimit = subscriptionPlan.businessLimit;
            }

            await user.save();

            res.status(200).json({
                message: 'Subscription plan updated successfully',
                subscription: {
                    plan: user.subscription.plan,
                    startDate: user.subscription.startDate,
                    expiryDate: user.subscription.expiryDate
                }
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


async function retrieveSession(sessionId) {
    try {
        return await stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
        throw new Error(`Failed to retrieve session: ${error.message}`);
    }
}

async function editBusiness(req, res) {
    const { 
        businessId, 
        name, 
        phone, 
        location, 
        targetMapArea, 
        description, 
        removeGalleryItems, // Array of URLs to remove
        websiteUrl,
        facebookUrl,
        instagramUrl,
        linkedinUrl,
        tiktokUrl
    } = req.body;
    const userId = req.user._id;

    try {
        // Get business object from DB
        const business = await Business.findById(businessId);
        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        // Ensure user is authorized
        if (business.owner.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'You are not authorized to edit this business' });
        }

        // Update business fields if provided
        if (name) business.name = name;
        if (phone) business.phone = phone;
        if (location) business.location = location;
        if (targetMapArea) business.targetMapArea = targetMapArea;
        if (description) business.description = description;

        // Update URLs if provided
        if (websiteUrl !== undefined) business.websiteUrl = websiteUrl;
        if (facebookUrl !== undefined) business.facebookUrl = facebookUrl;
        if (instagramUrl !== undefined) business.instagramUrl = instagramUrl;
        if (linkedinUrl !== undefined) business.linkedinUrl = linkedinUrl;
        if (tiktokUrl !== undefined) business.tiktokUrl = tiktokUrl;

        // Remove gallery items from Azure Blob Storage if URLs are provided
        if (removeGalleryItems && Array.isArray(removeGalleryItems)) {
            for (const urlToRemove of removeGalleryItems) {
                // Find the corresponding URL in the gallery
                const index = business.gallery.indexOf(urlToRemove);
                
                if (index > -1) {
                    // Extract the filename from the URL
                    const fileName = urlToRemove.split('/').pop();
                    
                    // Delete the blob from Azure
                    await deleteFromAzureBlob(fileName);
                    
                    // Remove the URL from the gallery array
                    business.gallery.splice(index, 1);
                }
            }
        }

        // Add new gallery items to Azure Blob Storage
        if (req.files && req.files.gallery) {
            for (const file of req.files.gallery) {
                const fileName = `${Date.now()}${path.extname(file.originalname)}`;
                const fileUrl = await uploadToAzureBlob(file.buffer, fileName);
                business.gallery.push(fileUrl); // Add new URL to gallery
            }
        }

        // Update logo in Azure Blob Storage
        if (req.files && req.files.logo) {
            const logoFile = req.files.logo[0];
            const logoFileName = `${Date.now()}${path.extname(logoFile.originalname)}`;
            business.logo = await uploadToAzureBlob(logoFile.buffer, logoFileName); // Update logo URL
        }

        // Save updated business object
        await business.save();

        res.status(200).json({ message: 'Business updated successfully', business });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


async function deleteBusiness(req, res) {
    const { businessId } = req.params; // Get the business ID from the request parameters
    const userId = req.user._id; // Ensure `req.user` has the `_id` property

    try {
        // Find the business by ID
        const business = await Business.findById(businessId);

        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        // Check if the user is the owner of the business
        if (business.owner.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'You are not authorized to delete this business' });
        }

        // Remove the business from the database
        await Business.findByIdAndDelete(businessId);

        // Optionally, you can also remove the business ID from the user's businesses array
        const user = await User.findById(userId);
        user.businesses = user.businesses.filter(b => b.toString() !== businessId);
        await user.save();

        res.status(200).json({ message: 'Business deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


module.exports = {
    addBusiness: [upload, addBusiness],
    getUserBusinesses,
    selectSubscriptionPlan,
    confirmPaymentAndUpdateSubscription,
    editBusiness: [upload, editBusiness],
    deleteBusiness,
};