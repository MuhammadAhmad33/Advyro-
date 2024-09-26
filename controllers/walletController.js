const mongoose = require('mongoose');
const Wallet = require('../models/wallet');
const Transaction = require('../models/transaction');
const Chat = require('../models/chat');

exports.addAmountToWallet = async (req, res) => {
  const userId = req.params.userId;
  const { amount } = req.body;

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
  }

  // Validate amount
  if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount. It must be a positive number.' });
  }

  try {
      // Get wallet balance
      let wallet = await Wallet.findOne({ user_id: userId });

      // Initialize wallet if not found
      if (!wallet) {
          wallet = new Wallet({ user_id: userId, balance: 0 });
          await wallet.save();
      }

      // Update wallet balance
      wallet.balance += amount;
      await wallet.save();

      // Log transaction as a refund (type as 'payment')
      const transaction = new Transaction({
          user_id: userId,
          amount: amount,
          type: 'payment', // Use 'payment' for refunds
          status: 'completed', // Mark as completed since the refund is processed
          created_at: new Date(),
      });
      await transaction.save();

      return res.status(200).json({
          balance: wallet.balance,
          message: 'Amount added to wallet successfully',
      });
  } catch (error) {
      console.error('Error adding amount to wallet:', error);
      return res.status(500).json({ message: 'Server error', error });
  }
};

// Get Wallet Balance and Withdrawal History separated by Status (Approved and Pending)
exports.getWalletAndWithdrawalInfo = async (req, res) => {
  const userId = req.params.userId;

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid user ID format' });
  }

  try {
    // Step 1: Get wallet balance
    let wallet = await Wallet.findOne({ user_id: userId });

    // Initialize wallet if not found
    if (!wallet) {
      wallet = new Wallet({ user_id: userId, balance: 0 });
      await wallet.save();
    }

    // Step 2: Retrieve withdrawal requests from chat messages
    const chat = await Chat.findOne({ user_id: userId });

    if (!chat) {
      return res.status(200).json({
        balance: wallet.balance,
        withdrawals: {
          approved: [],
          pending: [],
        },
      });
    }

    // Step 3: Filter withdrawal messages by status
    const withdrawalMessages = chat.messages.filter(
      (message) => message.message_type === 'withdraw'
    );

    const approvedWithdrawals = withdrawalMessages.filter(
      (message) => message.status === 'confirmed'
    );
    const pendingWithdrawals = withdrawalMessages.filter(
      (message) => message.status === 'pending'
    );

    // Sort by creation date
    approvedWithdrawals.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    pendingWithdrawals.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Step 4: Return the balance and withdrawals
    return res.status(200).json({
      balance: wallet.balance,
      withdrawals: {
        approved: approvedWithdrawals,
        pending: pendingWithdrawals,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};
