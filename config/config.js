const mongoose = require('mongoose');
const StripeKey = require('../models/stripeKey'); // Adjust the path as needed

// Default Stripe secret key for fallback
const defaultStripeKey = 'sk_test_51PWFAtRsuZrhcR6RkARSyeTININjrF9jCGyX578O6uoZJBjtuTYwcIfjGarejovYy4O1ONuLhiiZksJpcRU5BUzE0063W9ijCB';

// Function to get the Stripe key from the database asynchronously
async function fetchStripeSecretKey() {
    try {
        const stripeKey = await StripeKey.findOne({});
        if (stripeKey) {
            console.log('Fetched Stripe Key from DB:', stripeKey.secretKey);
            return stripeKey.secretKey;
        } else {
            console.log('Stripe key not found in the database. Using default.');
            return defaultStripeKey;
        }
    } catch (err) {
        console.error('Error fetching Stripe key:', err);
        return defaultStripeKey; // Fallback to default if there's an error
    }
}

// Initialize configuration object
const config = {
    mongoURI: 'mongodb+srv://officialshafiqahmad:BVdMnHpBZOTCX4H6@advyrocluster.pmrql.mongodb.net/?retryWrites=true&w=majority&appName=AdvyroCluster/',
    JWT_SECRET: 'Advyro',
    resendApiKey: 're_KXbbyurt_6evMKBFkGNgMaWwCYpQk2qnN',
    STRIPE_SECRET_KEY: "sk_test_51PWFAtRsuZrhcR6RkARSyeTININjrF9jCGyX578O6uoZJBjtuTYwcIfjGarejovYy4O1ONuLhiiZksJpcRU5BUzE0063W9ijCB",
    AZURE_STORAGE_CONNECTION_STRING: 'DefaultEndpointsProtocol=https;AccountName=advyrostorage;AccountKey=kTxhsbD7Nge/cLN3s8aZDJPpq3bw/g95XmrgvGaJ8jAoHO6YdeONCiEmoEChbEi0lBXs09wAlW6g+AStrifBWA==;EndpointSuffix=core.windows.net',
    AZURE_CONTAINER_NAME: 'advyrocontainer'
};

// Fetch the Stripe secret key and update the config
fetchStripeSecretKey().then(stripeKey => {
    config.STRIPE_SECRET_KEY = stripeKey; // Update the key in the config
});

// Export the config
module.exports = config;
