const express = require('express');
const { check } = require('express-validator');
const authController = require('../controllers/authController');
const { verifyOTP } = require('../utils/otpVerifier');
const auth = require('../middleware/auth')
const router = express.Router();

// User registration route
router.post('/register', [
    check('fullname').not().isEmpty().withMessage('Full name is required'),
    check('email').isEmail().withMessage('Valid email is required'),
    check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    check('confirmPassword').custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error('Password confirmation does not match password');
        }
        return true;
    }).withMessage('Passwords do not match'),
    check('role').optional().isIn(['customer', 'mid admin', 'super admin']).withMessage('Invalid role')
], authController.registerUser);


router.post('/login', [
    check('email').isEmail().withMessage('Valid email is required'),
    check('password').not().isEmpty().withMessage('Password is required')
], authController.loginUser);

router.post('/forgot-password', [
    check('email').isEmail().withMessage('Valid email is required')
], authController.forgotPassword);

router.post('/reset-password', [
    auth,
    check('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], authController.resetPassword);

router.post('/verify-otp', [
  check('email').isEmail().withMessage('Must be a valid email'),
  check('otp').isLength({ min: 4, max: 4 }).withMessage('OTP must be 4 digits')
], async (req, res) => {
  const { email, otp } = req.body;

  const token = await verifyOTP(email, otp); // Call verifyOTP and wait for the result

  if (token) {
    return res.status(200).json({
      message: 'OTP verified successfully',
      token // Include the token in the response
    });
  } else {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }
});

module.exports = router;
