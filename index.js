require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const authRoute = require('./routes/authRoute');
const config = require('./config/config');
const businessRoute = require('./routes/businessRoute');
const campaignRoute = require('./routes/campaignRoutes');
const midAdminRoute = require('./routes/midAdminRoutes');
const superAdminRoute = require('./routes/superAdminRoutes');
const stripeRoute = require('./routes/stripeRoutes');
const coinRoute = require('./routes/coinRoute');
const walletRoute = require('./routes/walletRoute'); // Import wallet routes
const app = express();

app.use(express.json()); // Middleware for parsing JSON

// Use routes
app.use('/user', authRoute);
app.use('/business', businessRoute);
app.use('/campaign', campaignRoute);
app.use('/midAdmin', midAdminRoute);
app.use('/coin', coinRoute);
app.use('/superAdmin', superAdminRoute);
app.use('/stripe', stripeRoute);
app.use('/wallet', walletRoute); // Add wallet routes

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err); // Log the error
    res.status(500).json({ message: err.message }); // Send error response
});

// Connect to MongoDB
mongoose.connect(config.mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err));

// Start the server
const PORT = process.env.PORT || 7002;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
