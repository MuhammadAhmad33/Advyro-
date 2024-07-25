require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const authRoute = require('./routes/authRoute');
const config = require('./config/config');
const app = express();

app.use(express.json());


mongoose.connect(config.mongoURI, {})
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err));

app.use('/user', authRoute);

// Start the server
const PORT = 7002;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});