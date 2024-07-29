const User = require('../models/user');
const Business = require('../models/business');

async function changeBusinessStatus(req, res) {
    const { businessId, status } = req.body;
    const midAdminId = req.user.id;

    try {
        const user = await User.findById(midAdminId);
        if (!user || user.role !== 'mid admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const business = await Business.findById(businessId);
        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        business.status = status;
        await business.save();

        res.status(200).json({ message: `Business ${status} successfully` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports={
    changeBusinessStatus
}
