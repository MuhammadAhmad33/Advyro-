const jwt = require('jsonwebtoken');

// Function to generate JWT token
function generateToken(userId) {
    const payload = {
        userId: userId,
    };

    const secretKey = 'GSTaxi';

    const options = {
        expiresIn: '1h', // Token expires in 1 hour
    };

    const token = jwt.sign(payload, secretKey, options);
    return token;
}

function decodeToken(req, res, next) {
    // Get token from request headers or query parameters
    const token = req.headers.authorization || req.query.token;

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    // Verify and decode the token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Failed to authenticate token' });
        }
        // Attach the user ID to req.user
        req.user = decoded.userId;
        console.log('UserId', req.user);
        next();
    });
}

module.exports = { generateToken, decodeToken };
