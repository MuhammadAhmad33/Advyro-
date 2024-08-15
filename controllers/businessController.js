const { BlobServiceClient } = require('@azure/storage-blob');
const User = require('../models/users');
const Business = require('../models/business');
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

async function addBusiness(req, res) {
    const { 
        name, phone, location, targetMapArea, description,
        websiteUrl, facebookUrl, instagramUrl, linkedinUrl, tiktokUrl 
    } = req.body;
    const userId = req.user._id;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (!user.subscription.plan) {
            return res.status(404).json({ message: 'Get a subscription first!' });
        }

        const allowedBusinessCount = planLimits[user.subscription.plan] || 0;
        if (user.businesses.length >= allowedBusinessCount) {
            return res.status(400).json({ message: 'Business limit reached for your subscription plan' });
        }

        const gallery = [];
        let logo = '';

        if (req.files.gallery) {
            for (const file of req.files.gallery) {
                const url = await uploadToAzureBlob(file.buffer, Date.now() + path.extname(file.originalname));
                gallery.push(url);
                console.log(url)
            }
        }

        if (req.files.logo) {
            logo = await uploadToAzureBlob(req.files.logo[0].buffer, Date.now() + path.extname(req.files.logo[0].originalname));
        }

        const newBusiness = new Business({
            name, phone, location, targetMapArea, description,
            gallery, logo, owner: userId, status: 'pending',
            websiteUrl, facebookUrl, instagramUrl, linkedinUrl, tiktokUrl
        });

        const savedBusiness = await newBusiness.save();
        user.businesses.push(savedBusiness._id);
        await user.save();
        console.log(savedBusiness)

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
};

// Prices for the subscription plans in the smallest currency unit (cents for USD)
const prices = {
    basic: 1000,   // $10
    standard: 2500, // $25
    pro: 5000,     // $50
};

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

        if (!prices[plan]) {
            return res.status(400).json({ error: 'Invalid subscription plan' });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
                    },
                    unit_amount: prices[plan],
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `http://localhost:7002/payment-success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
            cancel_url: `http://localhost:7002/payment-cancel`,
            client_reference_id: userId.toString(), // Add user ID as a reference
        });

        console.log('Checkout Session created:', session.id);
        res.status(200).json({ 
            sessionId: session.id,
            checkoutUrl:session.url
        });
    } catch (error) {
        console.error('Error in selectSubscriptionPlan:', error);
        res.status(500).json({ error: error.message });
    }
};

const confirmPaymentAndUpdateSubscription = async (req, res) => {
    const { session_id, plan } = req.query;

    try {
        // Retrieve the session from Stripe using the session ID
        const session = await retrieveSession(session_id);
        console.log(session)

        // Check if the payment was successful
        if (session.payment_status === 'paid') {
            // Update user subscription in the database
            const user = await User.findById(req.user._id);

            if (user) {
                user.subscription.plan = plan;
                user.subscription.startDate = Date.now();
                await user.save();

                res.status(200).json({ message: 'Subscription plan updated successfully', subscription: user.subscription });
            } else {
                res.status(404).json({ message: 'User not found' });
            }
        } else {
            res.status(400).json({ message: 'Payment not completed' });
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

        // Remove gallery items from Azure Blob Storage
        if (removeGalleryItems && Array.isArray(removeGalleryItems)) {
            for (const url of removeGalleryItems) {
                // Extract the filename from the URL
                const fileName = url.split('/').pop();
                
                // Delete the blob from Azure
                await deleteFromAzureBlob(fileName);
                
                // Remove the URL from the gallery array
                business.gallery = business.gallery.filter(item => item !== url);
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