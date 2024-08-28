const admin = require('firebase-admin');

// Replace with the path to your service account key JSON file
const serviceAccount = require('./advyro-33ad7-firebase-adminsdk-49tu8-de7d26091a.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;