const Chat = require('../models/chat');
const Wallet = require('../models/wallet');
const User = require('../models/users');

// Get Chat List (Super Admin Side)
exports.getChatList = async (req, res) => {
  try {
    // Fetch all chats
    const chats = await Chat.find().sort({ last_message_time: -1 });

    // Prepare an array to hold the formatted chat details
    const formattedChats = [];

    // Loop through each chat to populate user details
    for (const chat of chats) {
      // Fetch user details based on user_id
      const user = await User.findById(chat.user_id).select('fullname profilePic');

      // Count unread messages
      const unreadMessagesCount = chat.messages.filter(message => !message.is_read).length;

      // Format chat details
      formattedChats.push({
        _id: chat._id,
        user_id: {
          _id: user._id,
          name: user.fullname || "", // Use fullname from the User schema
          profile_picture: user.profilePic || "" // Use profile picture from the User schema
        },
        unread_messages: unreadMessagesCount,
        last_message: chat.last_message || "", // Ensure a default value for last message
        last_message_time: chat.last_message_time, // Last message time
        __v: chat.__v // Include the version key if needed
      });
    }

    // Return the formatted response
    return res.status(200).json(formattedChats);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

// Get Chat Detail (for Super Admin to see messages of a particular user)
exports.getChatDetail = async (req, res) => {
  try {
    // Find the chat by user ID
    const chat = await Chat.findOne({ user_id: req.params.userId });
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Update the is_read status for all unread messages
    chat.messages.forEach(message => {
      if (!message.is_read) {
        message.is_read = true;
      }
    });

    // Save the updated chat
    await chat.save();

    // Filter messages based on `message_type`
    const filteredMessages = chat.messages.map(message => {
      if (message.message_type === 'message') {
        // Remove fields for 'message' type
        return {
          _id: message._id,
          message_type: message.message_type,
          text: message.text,
          status: message.status,
          is_read: message.is_read,
          sender: message.sender,
          created_at: message.created_at
        };
      } else if (message.message_type === 'withdraw') {
        // Return all fields for 'withdraw' type
        return {
          _id: message._id,
          message_type: message.message_type,
          text: message.text,
          bank_name: message.bank_name,
          account_title: message.account_title,
          IBAN: message.IBAN,
          amount: message.amount,
          status: message.status,
          is_read: message.is_read,
          sender: message.sender,
          created_at: message.created_at
        };
      }
    });

    // Return the filtered messages
    return res.status(200).json(filteredMessages);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

// Send Message (User to Super Admin)
exports.sendUserMessage = async (req, res) => {
  const { userId, text } = req.body;
  try {
    let chat = await Chat.findOne({ user_id: userId });

    if (!chat) {
      chat = new Chat({
        user_id: userId,
        messages: [],
      });
    }

    chat.messages.push({
      message_type: 'message',
      text,
      sender: 'user', // sender type for users
      is_read: false,
    });

    chat.last_message = text;
    chat.last_message_time = Date.now();
    chat.last_message_read = false;

    await chat.save();

    return res.status(200).json({ message: 'Message sent successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

// Send Message (Super Admin to User)
exports.sendAdminMessage = async (req, res) => {
  const { userId, text } = req.body;
  try {
    let chat = await Chat.findOne({ user_id: userId });

    if (!chat) {
      chat = new Chat({
        user_id: userId,
        messages: [],
      });
    }

    chat.messages.push({
      message_type: 'message',
      text,
      sender: 'admin', // sender type for super admins
      is_read: true, // Mark as read since admin is sending the message
    });

    chat.last_message = text;
    chat.last_message_time = Date.now();
    chat.last_message_read = true;

    await chat.save();

    return res.status(200).json({ message: 'Admin message sent successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};

// Send Withdrawal Request (User Side)
exports.sendWithdrawalRequest = async (req, res) => {
  const { userId, bank_name, account_title, IBAN, amount } = req.body;

  try {
    // Step 1: Check the wallet balance for this user
    const wallet = await Wallet.findOne({ user_id: userId });

    if (!wallet) {
      return res.status(400).json({ message: 'Wallet not found.' });
    }

    // Step 2: Check if the wallet balance is sufficient for the withdrawal request
    if (wallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance for this withdrawal request.' });
    }

    // Step 3: Check if there is a pending withdrawal request in the chat
    const chat = await Chat.findOne({ user_id: userId });

    if (chat) {
      const pendingWithdrawal = chat.messages.find(
        (message) => message.message_type === 'withdraw' && message.status === 'pending'
      );

      if (pendingWithdrawal) {
        return res.status(400).json({ message: 'A withdrawal request is already pending.' });
      }
    }

    // Step 4: If no pending withdrawal, proceed to create a new withdrawal request in the chat
    let newChat = chat;
    if (!chat) {
      newChat = new Chat({
        user_id: userId,
        messages: [],
      });
    }

    // Add the new withdrawal request message to the chat
    newChat.messages.push({
      message_type: 'withdraw',
      bank_name,
      account_title,
      IBAN,
      amount,
      sender: 'user',
      status: 'pending',
      is_read: false,
    });

    // Update the chat's last message details
    newChat.last_message = 'Withdrawal Request';
    newChat.last_message_time = Date.now();
    newChat.last_message_read = false;

    // Step 5: Save the chat with the new withdrawal request
    await newChat.save();

    return res.status(200).json({ message: 'Withdrawal request sent successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};


// Confirm Withdrawal (Super Admin Side)
exports.confirmWithdrawal = async (req, res) => {
  const { userId, messageId } = req.body;

  try {
    // Step 1: Find the chat for the user
    const chat = await Chat.findOne({ user_id: userId });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Step 2: Find the specific withdrawal message by its ID
    const withdrawalMessage = chat.messages.id(messageId);

    if (!withdrawalMessage || withdrawalMessage.message_type !== 'withdraw') {
      return res.status(400).json({ message: 'Invalid withdrawal request' });
    }

    // Step 3: Check if the withdrawal is already confirmed
    if (withdrawalMessage.status === 'confirmed') {
      return res.status(400).json({ message: 'Withdrawal is already confirmed' });
    }

    // Step 4: Find the user's wallet
    const wallet = await Wallet.findOne({ user_id: userId });

    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    // Step 5: Check if the wallet balance is sufficient
    if (wallet.balance < withdrawalMessage.amount) {
      return res.status(400).json({ message: 'Insufficient balance in wallet to confirm withdrawal' });
    }

    // Step 6: Deduct the withdrawal amount from the wallet balance
    wallet.balance -= withdrawalMessage.amount;
    await wallet.save();

    // Step 7: Update the withdrawal message status to 'confirmed' and mark it as read
    withdrawalMessage.status = 'confirmed';
    withdrawalMessage.is_read = true;

    // Step 8: Save the updated chat
    await chat.save();

    return res.status(200).json({ message: 'Withdrawal confirmed successfully', chat, balance: wallet.balance });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
};
