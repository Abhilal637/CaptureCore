const User = require('../models/user');
const Address = require('../models/address');
const WalletTransaction = require('../models/walletTransaction');
const product = require('../models/product');
const bcrypt= require('bcrypt')
const nodemailer= require('nodemailer')
require('dotenv').config()
const otpService = require('../utils/otpHelper');
const { STATUS_CODES, MESSAGES } = require('../utils/constants');

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

    const updateData = { name };
    if (phone && phone.trim()) {
      updateData.mobile = phone.trim();
    }
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
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    })

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: newEmail,
        subject: 'Verify Your Email',
        text: `Your OTP for updating email is ${otp}`,
        html: `<p>Your OTP for updating email is <b>${otp}</b></p>`
      })
    } catch (emailErr) {
      console.error('Failed to send OTP email:', emailErr);
      return res.render('user/edit-email', { error: 'Failed to send OTP email. Please try again later.', currentPage: 'edit-email' });
    }

    res.redirect('/verify-email')
  } catch (error) {
    console.log('Error sending OTP:', error);
      res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send('something went wrong')
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
      error: null,
      success: req.query.success
    });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    res.render('user/addresses', {
      addresses: [],
      currentPage: 'addresses',
      error: 'Failed to load addresses',
      success: req.query.success
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

  const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';

  if (req.validationErrors) {
    if (isAjax) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ 
        success: false, 
        errors: req.validationErrors 
      });
    }
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

    // Normalize inputs (trim and collapse spaces) to prevent near-duplicate entries
    const normalize = (v) => (v || '').toString().trim().replace(/\s+/g, ' ');
    const normalized = {
      fullName: normalize(addressData.fullName),
      phone: normalize(addressData.phone),
      addressLine: normalize(addressData.addressLine),
      city: normalize(addressData.city),
      state: normalize(addressData.state),
      pincode: normalize(addressData.pincode),
      country: normalize(addressData.country || 'India')
    };

 
    const existingAddress = await Address.findOne({
      user: userId,
      fullName: normalized.fullName,
      phone: normalized.phone,
      addressLine: normalized.addressLine,
      city: normalized.city,
      state: normalized.state,
      pincode: normalized.pincode
    });

    if (existingAddress) {
      if (isAjax) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({ 
          success: false, 
          error: 'This address already exists in your address book.' 
        });
      }
      return res.render('user/add-address', {
        currentPage: 'add-address',
        error: 'This address already exists in your address book.',
        formData: req.body
      });
    }

    
    const isDefaultFlag = isDefault === 'true' || isDefault === 'on' || isDefault === true;
    if (isDefaultFlag) {
      await Address.updateMany({ user: userId }, { $set: { isDefault: false } });
    }

    await Address.create({
      ...normalized,
      user: userId,
      isDefault: isDefaultFlag
    });

    if (isAjax) {
    
      res.set('X-Redirect-To', '/addresses?success=address_added');
      return res.status(STATUS_CODES.OK).json({ 
        success: true, 
        message: MESSAGES.SUCCESS.ADDRESS_ADDED 
      });
    }

    res.redirect('/addresses?success=address_added');
  } catch (error) {
    console.error('Error adding address:', error);

    
    if (error && error.code === 11000) {
      if (isAjax) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          error: 'This address already exists in your address book.'
        });
      }
      return res.render('user/add-address', {
        currentPage: 'add-address',
        error: 'This address already exists in your address book.',
        formData: req.body
      });
    }

    if (isAjax) {
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
        success: false, 
        error: MESSAGES.ERROR.SERVER_ERROR 
      });
    }

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
  const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest';
 
  if (req.validationErrors) {
    if (isAjax) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, errors: req.validationErrors });
    }
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

    const normalize = (v) => (v || '').toString().trim().replace(/\s+/g, ' ');
    const normalized = {
      fullName: normalize(addressData.fullName),
      phone: normalize(addressData.phone),
      addressLine: normalize(addressData.addressLine),
      city: normalize(addressData.city),
      state: normalize(addressData.state),
      pincode: normalize(addressData.pincode),
      country: normalize(addressData.country || 'India')
    };

    const existingAddress = await Address.findOne({
      user: userId,
      _id: { $ne: addressId }, // Exclude current address
      fullName: normalized.fullName,
      phone: normalized.phone,
      addressLine: normalized.addressLine,
      city: normalized.city,
      state: normalized.state,
      pincode: normalized.pincode
    });

    if (existingAddress) {
      const address = await Address.findOne({ _id: addressId, user: req.session.userId });
      return res.render('user/edit-address', {
        address,
        currentPage: 'edit-address',
        error: 'This address already exists in your address book.',
        body: req.body
      });
    }

    const isDefaultFlag = isDefault === 'true' || isDefault === 'on' || isDefault === true;
    if (isDefaultFlag) {
      await Address.updateMany({ user: userId }, { $set: { isDefault: false } });
    }

    await Address.updateOne(
      { _id: addressId, user: userId },
      {
        ...normalized,
        isDefault: isDefaultFlag
      }
    );

    if (isAjax) {
      return res.status(STATUS_CODES.OK).json({
        success: true,
        address: { _id: addressId, ...normalized, isDefault: isDefaultFlag }
      });
    }

    res.redirect('/addresses');
  } catch (error) {
    console.error('Error updating address:', error);
    if (isAjax) {
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, error: 'Failed to update address' });
    }
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
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).render('error', { message: 'Failed to load wallet data' });  
  }
};


exports.sendEmailOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(STATUS_CODES.UNAUTHORIZED).json({ success: false, message: 'Not authenticated' });
    }

    const existingUser = await User.findOne({ email, _id: { $ne: userId } });
    if (existingUser) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Email is already in use' });
    }

    const otp = otpService.generateOtp();
    const otpExpiry = Date.now() + 2 * 60 * 1000;

    await User.findByIdAndUpdate(userId, { otp, otpExpiry });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Email Change OTP',
      text: `Your OTP for changing email is: ${otp}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Email Change Verification</h2>
          <p>You requested to change your email address. Use the following OTP to verify:</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; font-size: 32px; margin: 0;">${otp}</h1>
          </div>
          <p>This OTP will expire in 2 minutes.</p>
          <p>If you didn't request this change, please ignore this email.</p>
        </div>
      `
    });

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error sending email OTP:', error);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to send OTP' });
  }
};


exports.verifyEmailOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(STATUS_CODES.UNAUTHORIZED).json({ success: false, message: 'Not authenticated' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: 'User not found' });
    }

    if (user.otp !== otp || user.otpExpiry < Date.now()) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.email = email;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.json({ success: true, message: 'Email updated successfully' });
  } catch (error) {
    console.error('Error verifying email OTP:', error);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to verify OTP' });
  }
};

