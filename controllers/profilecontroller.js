const User = require('../models/user');
const Address = require('../models/address');
const WalletTransaction = require('../models/walletTransaction');
const product = require('../models/product');
const bcrypt= require('bcrypt')
const nodemailer= require('nodemailer')
exports.getProfile = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.redirect('/login');
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect('/login');
    }
    res.render('user/profile', {
      user,
      currentPage: 'profile',
      success: req.query.success,
      error: req.query.error
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.render('user/profile', {
      error: 'Failed to load profile',
      user: null,
      currentPage: 'profile',
      success: req.query.success,
      error: req.query.error
    });
  }
};


exports.getEditProfile = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.redirect('/login');
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect('/login');
    }
    res.render('user/edit-profile', {
      user,
      currentPage: 'edit-profile',
      error: req.query.error
    });
  } catch (err) {
    console.error('Edit profile error:', err);
    res.redirect('/profile');
  }
}

exports.postEditProfile = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.redirect('/login');
    }
    
    const { name, phone } = req.body;
    const profilePicture = req.file ? req.file.filename : null;

    
    if (req.file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.redirect('/edit-profile?error=invalid_file_type');
      }
    }

    const updateData = { name, phone };
    if (profilePicture) {
      updateData.profilePicture = profilePicture;
    }

    await User.findByIdAndUpdate(userId, updateData, { new: true });
    res.redirect('/profile?success=profile_updated');
  } catch (err) {
    console.error('Update profile error:', err);
    res.redirect('/edit-profile');
  }
}


exports.getEditEmail = async (req, res) => {
  res.render('user/edit-email', { currentPage: 'edit-email' });
}

exports.sendOtpForEmail = async (req, res) => {
  const { newEmail } = req.body
  console.log('sendOtpForEmail called with:', newEmail);

  try {
    const existingUser = await User.findOne({ email: newEmail })
    if (existingUser) {
      return res.render('user/edit-email', { error: "Email already in use", currentPage: 'edit-email' })
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    req.session.pendingEmail = newEmail
    req.session.emailOtp = otp

    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS

      }
    })

    await transporter.sendMail({
      to: newEmail,
      subject: 'verify Your Email',
      html: `<p>Your OTP for updating email is <b>${otp}</b><p>`
    })


    res.redirect('/verify-email')
  } catch (error) {
    console.log('Error sending OTP:', error);
    res.status(500).send('something went wrong')
  }
}

exports.postverifyEmail = async (req, res) => {
  const { otp } = req.body

  if (otp === req.session.emailOtp) {
    const userId = req.session.userId

    await User.findByIdAndUpdate(userId, {
      email: req.session.pendingEmail
    })


    req.session.emailOtp = null
    req.session.pendingEmail = null

    res.redirect('/profile')
  } else {
    res.render('user/verify-email', {
      newEmail: req.session.pendingEmail,
      error: 'Invalid OTP'
    })
  }
}




exports.getChangePassword = (req, res) => {
  res.render('user/change-password', { currentPage: 'change-password' })
}
exports.postChangePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body

  try {
    const user = await User.findById(req.session.userId)


    if (!user) {
      return res.redirect('/login')
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      return res.render('user/change-password', {
        currentPage: 'change-password',
        error: 'Incorrect current password'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.render('user/change-password', {
        currentPage: 'change-password',
        error: 'New passwords do not match'
      });
    }



    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword
    await user.save()

    res.redirect('/profile?success=password_changed');
  } catch (error) {
    console.log('Error changing password', error);
    res.render('user/change-password', {
      currentPage: 'change-password',
      error: 'An error occurred while changing password. Please try again.'
    });
  }
}

exports.getAddresses = async (req, res) => {
  try {
    const userId = req.session.userId;


    const defaultAddresses = await Address.find({ user: userId, isDefault: true });
    if (defaultAddresses.length > 1) {
     
      const [firstDefault, ...otherDefaults] = defaultAddresses;
      if (otherDefaults.length > 0) {
        await Address.updateMany(
          { _id: { $in: otherDefaults.map(addr => addr._id) } },
          { $set: { isDefault: false } }
        );
      }
    }

    const addresses = await Address.find({ user: userId });
    res.render('user/addresses', {
      addresses,
      currentPage: 'addresses',
      error: null
    });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    res.render('user/addresses', {
      addresses: [],
      currentPage: 'addresses',
      error: 'Failed to load addresses'
    });
  }
};

exports.getAddress = (req, res) => {
  res.render('user/add-address', {
    currentPage: 'add-address',
    error: null,
    formData: {}
  });
};

exports.postAddaddress = async (req, res) => {

  if (req.validationErrors) {
    return res.render('user/add-address', {
      currentPage: 'add-address',
      errors: req.validationErrors,
      body: req.body,
      error: null,
      formData: req.body
    });
  }

  try {
    const userId = req.session.userId;
    const { isDefault, ...addressData } = req.body || {};


    
    if (isDefault === 'true') {
      await Address.updateMany({ user: userId }, { $set: { isDefault: false } });
    }

    
    await Address.create({
      ...addressData,
      user: userId,
      isDefault: isDefault === 'true'
    });

    res.redirect('/addresses');
  } catch (error) {
    console.error('Error adding address:', error);
    res.render('user/add-address', {
      currentPage: 'add-address',
      error: 'Failed to add address. Please try again.',
      formData: req.body
    });
  }
};

exports.getEditAddresses = async (req, res) => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user: req.session.userId });
    if (!address) return res.redirect('/addresses');

    res.render('user/edit-address', {
      address,
      currentPage: 'edit-address',
      error: null
    });
  } catch (error) {
    console.error('Error fetching address for edit:', error);
    res.redirect('/addresses');
  }
};

exports.postEditAddress = async (req, res) => {
 
  if (req.validationErrors) {
    const address = await Address.findOne({ _id: req.params.id, user: req.session.userId });
    return res.render('user/edit-address', {
      address,
      currentPage: 'edit-address',
      errors: req.validationErrors,
      body: req.body,
      error: null
    });
  }

  try {
    const userId = req.session.userId;
    const addressId = req.params.id;
    const { isDefault, ...addressData } = req.body;

    // If this address is being set as default, first set all other addresses to false
    if (isDefault === 'true') {
      await Address.updateMany({ user: userId }, { $set: { isDefault: false } });
    }

    await Address.updateOne(
      { _id: addressId, user: userId },
      {
        ...addressData,
        isDefault: isDefault === 'true'
      }
    );

    res.redirect('/addresses');
  } catch (error) {
    console.error('Error updating address:', error);
    res.redirect('/addresses');
  }
};

exports.postDeleteAddress = async (req, res) => {
  try {
    await Address.deleteOne({ _id: req.params.id, user: req.session.userId });
    res.redirect('/addresses');
  } catch (error) {
    console.error('Error deleting address:', error);
    res.redirect('/addresses');
  }
};

exports.setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    const addressId = req.params.id;
    await Address.updateMany({ user: userId }, { $set: { isDefault: false } });
    await Address.findByIdAndUpdate(addressId, { isDefault: true });
    res.redirect('/addresses');
  } catch (error) {
    console.error('Error setting default address:', error);
    res.redirect('/addresses?error=Could not update default address');
  }
};
exports.getWallet = async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await User.findById(userId);

    const walletTransactions = await WalletTransaction.find({ userId })
      .sort({ createdAt: -1 });

    res.render('user/wallet', {
      user,
      walletTransactions,
      currentPage: 'wallet'
    });
  } catch (error) {
    console.error('Error fetching wallet data:', error);
    res.status(500).render('error', { message: 'Failed to load wallet data' });
  }
};