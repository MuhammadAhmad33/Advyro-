const User = require('../models/users');
const AdminCode = require('../models/adminCode')
const { generateToken } = require('../utils/jwt');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const { sendEmail, sendOTPEmail } = require('../utils/sendEmail');
const generateOTP = require('../utils/otpGenerator');
const { storeOTP, verifyOTP } = require('../utils/otpVerifier');
const admin = require('../utils/firebase');
const config = require('../config/config');
const { BlobServiceClient } = require('@azure/storage-blob');
const multer = require('multer');
const path = require('path');


// Azure Blob Storage setup
const blobServiceClient = BlobServiceClient.fromConnectionString(config.AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(config.AZURE_CONTAINER_NAME);

// Set up Multer for file uploads
const storage = multer.memoryStorage(); // or diskStorage depending on your setup
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size (e.g., 5MB)
}).single('profilePic'); // Handle a single file, field name is 'profilePic'

async function uploadToAzureBlob(fileBuffer, fileName) {
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    await blockBlobClient.uploadData(fileBuffer);
    return blockBlobClient.url;
}

async function registerUser(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { fullname, email, phoneNumber, password, confirmPassword, role } = req.body;

    const otp = generateOTP();
    console.log(otp);
    storeOTP(email, otp);

    const subject = 'Registration Confirmation';
    const confirmationMessage = `
    Hi ${fullname}!
    Thank you for signing up for our platform!
    \nYour OTP code is: ${otp}
    \nBest regards,\nAdvyro`;

    if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
    }

    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            fullname,
            email,
            phoneNumber,
            password: hashedPassword,
            confirmPassword: hashedPassword,
            role: role || 'customer'
        });

        await sendEmail(email, subject, confirmationMessage);

        const savedUser = await newUser.save();
        const token = generateToken(savedUser._id);

        res.status(201).json({ message: 'User registered successfully', user: savedUser, token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function loginUser(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, fcmToken } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        const token = generateToken(user._id);
        user.fcmToken = fcmToken;
        await user.save();

        res.status(200).json({ message: 'Login successful', user, token, fcmToken });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ message: 'Error logging in' });
    }
}

async function forgotPassword(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        } else {
            const otp = generateOTP();
            console.log(otp);
            storeOTP(email, otp);
            await sendOTPEmail(email, otp);
            console.log(user);
            return res.status(200).json({ message: 'OTP sent to email' }); // Change status code to 200
        }
    } catch (error) {
        console.error('Error resetting password:', error);
        return res.status(500).json({ message: 'Internal server error' }); // Return a generic error message
    }
}

async function resetPassword(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user._id;
    const { newPassword, confirmPassword } = req.body;

    try {
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }
        const user = await User.findById(userId);

        if (!user) {
            return res.status(400).json({ message: 'Password reset token is invalid or has expired' });
        }
        console.log(user.password);
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.confirmPassword = hashedPassword;
        console.log(user.password);
        await user.save();

        res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}
async function midAdminSignup(req, res) {
    const { fullname, email, phoneNumber, password, confirmPassword, Code } = req.body;

    try {

        const otp = generateOTP();
        console.log(otp);
        storeOTP(email, otp);

        const subject = 'Registration Confirmation';
        const confirmationMessage = `
        Hi ${fullname}!
        Thank you for signing up for our platform!
        \nYour OTP code is: ${otp}
        \nBest regards,\nAdvyro`;
    

        // Log the received admin code for debugging
        console.log('Received admin code:', Code);

        // Check if the provided admin code exists in the database
        const code = await AdminCode.findOne({ code: Code}); // Use findOne to check for a single document
        console.log('Retrieved code from DB:', code); // Log the retrieved code

        // If the code is not found, return an error
        if (!code) {
            return res.status(400).json({ message: 'Invalid admin code' });
        }

        // Create the mid admin user
        const midAdmin = new User({
            fullname,
            email,
            phoneNumber,
            password,
            confirmPassword,
            role: 'mid admin',
        });
        
        await sendEmail(email, subject, confirmationMessage);
        await midAdmin.save();

        return res.status(201).json({ message: 'Mid admin created successfully', midAdmin });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
async function sendNotification(req, res) {
    const { title, body, fcmToken } = req.body;

    try {
        // Ensure body is an object
        if (typeof body !== 'object' || Array.isArray(body)) {
            return res.status(400).json({ message: 'Body must be a valid object' });
        }

        // Ensure fcmToken is provided
        if (!fcmToken) {
            return res.status(400).json({ message: 'FCM token is required' });
        }

        const message = {
            notification: {
                title: title,
                body: body.message, // Use the message field for the notification body
            },
            data: {
                details: JSON.stringify(body.details), // Include structured data in the data payload
            },
            token: fcmToken,
        };
        console.log('Sending message:', message);

        // Send the notification using Firebase Admin SDK
        const response = await admin.messaging().send(message);
        console.log('Successfully sent message:', response);

        res.status(200).json({ message: 'Notification sent successfully' });
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ message: 'Error sending notification', error: error.message });
    }
}


// Function to get FCM token of a user
const getFcmToken = async (req, res) => {
    try {
        const userId = req.params.id; // Assuming you're using middleware to set req.user

        // Find the user by ID
        const user = await User.findById(userId).select('fcmToken'); // Only select the fcmToken field

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Return the FCM token
        res.status(200).json({ fcmToken: user.fcmToken });
    } catch (error) {
        console.error('Error retrieving FCM token:', error);
        res.status(500).json({ message: 'Error retrieving FCM token', error: error.message });
    }
};

// Function to get user by ID
async function getUserById(req, res) {
    const userId = req.params.id;

    try {
        const user = await User.findById(userId).select('-password'); // Exclude password from response
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.status(200).json(user);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

// Function to edit user profile
async function editProfile(req, res) {
    const userId = req.params.id; // Assuming the user ID is passed in the URL
    const { fullname, email, phoneNumber, subscription } = req.body;

    try {
        // Find the user by ID and update the fields
        const user = await User.findByIdAndUpdate(userId, {
            fullname,
            email,
            phoneNumber,
            subscription
        }, { new: true, runValidators: true }).select('-password'); // Exclude password from response

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json({ message: 'Profile updated successfully', user });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

async function uploadProfilePic(req, res) {
    const userId = req.user._id; // Ensure `req.user` has the `_id` property

    try {
        // Check if a file is uploaded
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Upload the profile picture to Azure Blob Storage
        const profilePicUrl = await uploadToAzureBlob(req.file.buffer, Date.now() + path.extname(req.file.originalname));

        // Update the user's profile picture URL
        await User.findByIdAndUpdate(userId, { profilePic: profilePicUrl });

        res.status(200).json({ message: 'Profile picture uploaded successfully', profilePicUrl });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


  
module.exports = {
    registerUser,
    loginUser,
    forgotPassword,
    resetPassword,
    midAdminSignup,
    sendNotification,
    getFcmToken,
    getUserById,
    editProfile,
    uploadProfilePic:[upload,uploadProfilePic],
};
