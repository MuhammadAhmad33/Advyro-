require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const authRoute = require('./routes/authRoute');
const config = require('./config/config');
const businessRoute = require('./routes/businessRoute')
const campaignRoute = require('./routes/campaignRoutes')
const midAdminRoute = require('./routes/midAdminRoutes')
const app = express();

app.use(express.json()); // Middleware for parsing JSON

mongoose.connect(config.mongoURI, {})
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err));

// Use routes
app.use('/user', authRoute);
app.use('/business',businessRoute)
app.use('/campaign',campaignRoute)
app.use('/midAdmin',midAdminRoute)
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err); // Log the error
    res.status(500).json({ message: err.message }); // Send error response
});

// Start the server
const PORT = process.env.PORT || 7002;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
