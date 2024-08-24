const User = require('../models/users');
const { generateToken } = require('../utils/jwt');

// otpVerifier.js
const otpStore = new Map(); // Simple in-memory store for OTPs

const storeOTP = (email, otp) => {
  otpStore.set(email, { otp, expiresAt: Date.now() + 5 * 60 * 1000 }); // OTP expires in 5 minutes
};

const verifyOTP = async (email, otp) => {
  const data = otpStore.get(email);
  if (!data) return false;

  const user = await User.findOne({ email });
  if (!user) return false; // Ensure user exists

  const token = generateToken(user._id); // Generate token for the user

  const { otp: storedOtp, expiresAt } = data;
  if (Date.now() > expiresAt) {
    otpStore.delete(email); // OTP expired
    return false;
  }

  if (storedOtp === otp) {
    return token; // Return the token if OTP is valid
  }

  return false; // Return false if OTP does not match
};

module.exports = { storeOTP, verifyOTP };