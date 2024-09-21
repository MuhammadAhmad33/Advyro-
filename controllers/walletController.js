const Wallet = require('../models/wallet');
const Transaction = require('../models/transaction');

// Get Wallet Balance of User
exports.getWalletBalance = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user_id: req.params.userId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }
    return res.status(200).json({ balance: wallet.balance });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

// Get Payment History
exports.getPaymentHistory = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user_id: req.params.userId, type: 'payment' });
    return res.status(200).json({ payments: transactions });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

// Get Withdrawal History
exports.getWithdrawalHistory = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user_id: req.params.userId, type: 'withdraw' });
    return res.status(200).json({ withdrawals: transactions });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

// Withdraw Amount
exports.withdrawAmount = async (req, res) => {
  const { userId, amount } = req.body;

  try {
    const wallet = await Wallet.findOne({ user_id: userId });

    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Deduct from balance
    wallet.balance -= amount;
    wallet.last_updated = Date.now();
    await wallet.save();

    // Create a withdrawal transaction
    const transaction = new Transaction({
      user_id: userId,
      type: 'withdraw',
      amount,
      status: 'completed',
      created_at: Date.now(),
    });
    await transaction.save();

    return res.status(200).json({ message: 'Withdrawal successful', wallet });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

// Add Refund to Wallet
exports.addRefundToWallet = async (req, res) => {
  const { userId, amount } = req.body;

  try {
    let wallet = await Wallet.findOne({ user_id: userId });

    if (!wallet) {
      wallet = new Wallet({
        user_id: userId,
        balance: 0,
        last_updated: Date.now(),
      });
    }

    // Add the refund amount to wallet
    wallet.balance += amount;
    wallet.last_updated = Date.now();
    await wallet.save();

    // Create a payment (refund) transaction
    const transaction = new Transaction({
      user_id: userId,
      type: 'payment',
      amount,
      status: 'completed',
      created_at: Date.now(),
    });
    await transaction.save();

    return res.status(200).json({ message: 'Refund added to wallet', wallet });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};
