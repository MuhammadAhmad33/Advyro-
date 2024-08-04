const User = require('../models/users');
const Business = require('../models/business');
const multer = require('multer');
const path = require('path');
const config=require('../config/config')
const stripe = require('stripe')(config.STRIPE_SECRET_KEY);


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
        if (!user.subscription.plan) {
            return res.status(404).json({ message: 'Get a subscription first!' });

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
};

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