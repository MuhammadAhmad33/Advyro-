const express = require('express');
const { check } = require('express-validator');
const authController = require('../controllers/authController');

const router = express.Router();

// User registration route
router.post('/register', [
    check('fullname').not().isEmpty().withMessage('Full name is required'),
    check('email').isEmail().withMessage('Valid email is required'),
    check('address').not().isEmpty().withMessage('Address is required'),
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

router.post('/reset-password/:id', [
    check('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], authController.resetPassword);

module.exports = router;
