const User = require('../models/users');
const { generateToken } = require('../utils/jwt');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const {sendEmail,sendOTPEmail} = require('../utils/sendEmail');
const generateOTP = require('../utils/otpGenerator');
const { storeOTP, verifyOTP } = require('../utils/otpVerifier');


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

    const { email, password } = req.body;

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

        res.status(200).json({ message: 'Login successful', user, token });
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
            return res.status(500).json({ message: 'OTP sent to email'});
        }
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ message: 'Email does not exist kindly provide a valid email' });
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

module.exports = {
    registerUser,
    loginUser,
    forgotPassword,
    resetPassword
};
