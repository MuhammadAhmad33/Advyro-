require('dotenv').config(); // Load environment variables
const express = require('express');
const mongoose = require('mongoose');

// Import routes
const authRoute = require('./routes/authRoute');
const businessRoute = require('./routes/businessRoute');
const campaignRoute = require('./routes/campaignRoutes');
const midAdminRoute = require('./routes/midAdminRoutes');
const superAdminRoute = require('./routes/superAdminRoutes');
const stripeRoute = require('./routes/stripeRoutes');
const coinRoute = require('./routes/coinRoute');
const walletRoute = require('./routes/walletRoute'); // Wallet-related routes
const chatRoute = require('./routes/chatRoute'); // Chat-related routes

// Load configuration
const config = require('./config/config');

const app = express();
app.use(express.json()); // Middleware for parsing JSON

// Use routes with prefixes
app.use('/user', authRoute);
app.use('/business', businessRoute);
app.use('/campaign', campaignRoute);
app.use('/midAdmin', midAdminRoute);
app.use('/coin', coinRoute);
app.use('/superAdmin', superAdminRoute);
app.use('/stripe', stripeRoute);
app.use('/wallet', walletRoute); // Wallet-related routes
app.use('/chat', chatRoute); // Chat-related routes

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err); // Log the error
    res.status(500).json({ message: err.message || 'Internal Server Error' }); // Send error response
});

// Connect to MongoDB
mongoose.connect(config.mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Start the server
const PORT = 5566;

// app.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`);
// });

// Bind the server to 0.0.0.0
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});