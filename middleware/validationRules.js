// middleware/validationRules.js
const { check, body } = require('express-validator');

// ====== Common Patterns ======
const onlyLettersSpaces = /^[A-Za-z\s]+$/;
const onlyAlphanumericAndPunctuation = /^[A-Za-z0-9\s.,'"/\-()#&]+$/;
const phoneRegex = /^\d{10}$/;
const pincodeRegex = /^\d{6}$/;

const disallowConsecutiveDigits = (value) => {
  if (/^(\d)\1{9}$/.test(value)) {
    throw new Error('Phone number cannot have all digits the same');
  }
  return true;
};

// ====== Validation Schemas ======
module.exports = {
  // USER SIGNUP
  userSignupRules: [
    check('name')
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
      .matches(onlyLettersSpaces).withMessage('Name can only contain letters and spaces'),
    check('email')
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please enter a valid email address'),
    check('phone')
      .notEmpty().withMessage('Phone number is required')
      .matches(phoneRegex).withMessage('Phone number must be exactly 10 digits')
      .custom(disallowConsecutiveDigits),
    check('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    check('confirm_password')
      .notEmpty().withMessage('Please confirm your password')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
  ],

  // USER LOGIN
  userLoginRules: [
    check('email')
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please enter a valid email address'),
    check('password')
      .notEmpty().withMessage('Password is required'),
  ],

  // ADMIN LOGIN
  adminLoginRules: [
    check('email')
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please enter a valid email address'),
    check('password')
      .notEmpty().withMessage('Password is required'),
  ],

  // ADDRESS FORM
  addressRules: [
    check('fullName')
      .notEmpty().withMessage('Full name is required')
      .matches(onlyLettersSpaces).withMessage('Name can only contain letters and spaces')
      .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
    check('phone')
      .notEmpty().withMessage('Phone number is required')
      .matches(phoneRegex).withMessage('Phone number must be exactly 10 digits')
      .custom(disallowConsecutiveDigits),
    check('addressLine')
      .notEmpty().withMessage('Address is required')
      .matches(onlyAlphanumericAndPunctuation).withMessage('Address contains invalid characters')
      .isLength({ min: 5, max: 200 }).withMessage('Address must be between 5 and 200 characters'),
    check('pincode')
      .notEmpty().withMessage('Pincode is required')
      .matches(pincodeRegex).withMessage('Pincode must be exactly 6 digits'),
    check('state')
      .notEmpty().withMessage('State is required')
      .matches(onlyLettersSpaces).withMessage('State can only contain letters and spaces')
      .isLength({ min: 2, max: 50 }).withMessage('State must be between 2 and 50 characters'),
    check('city')
      .notEmpty().withMessage('City is required')
      .matches(onlyLettersSpaces).withMessage('City can only contain letters and spaces')
      .isLength({ min: 2, max: 50 }).withMessage('City must be between 2 and 50 characters'),
  ],

  // CATEGORY (Add/Edit)
  addcategoryRules: [
    check('categoryName')
      .notEmpty().withMessage('Category name is required')
      .matches(onlyLettersSpaces).withMessage('Category name can only contain letters and spaces')
      .isLength({ min: 2, max: 50 }).withMessage('Category name must be between 2 and 50 characters'),
  ],
  editcategoryRules: [
    check('categoryName')
      .notEmpty().withMessage('Category name is required')
      .matches(onlyLettersSpaces).withMessage('Category name can only contain letters and spaces')
      .isLength({ min: 2, max: 50 }).withMessage('Category name must be between 2 and 50 characters'),
  ],

  // PRODUCT (Add/Edit)
  addproductRules: [
    check('productName')
      .notEmpty().withMessage('Product name is required')
      .matches(onlyAlphanumericAndPunctuation).withMessage('Product name contains invalid characters')
      .isLength({ min: 2, max: 100 }).withMessage('Product name must be between 2 and 100 characters'),
    check('price')
      .notEmpty().withMessage('Price is required')
      .isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    check('stock')
      .notEmpty().withMessage('Stock is required')
      .isInt({ min: 0 }).withMessage('Stock must be a non-negative whole number'),
    check('description')
      .notEmpty().withMessage('Description is required')
      .matches(onlyAlphanumericAndPunctuation).withMessage('Description contains invalid characters')
      .isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
  ],

  editproductRules: [
    check('productName')
      .optional({ checkFalsy: true })
      .matches(onlyAlphanumericAndPunctuation).withMessage('Product name contains invalid characters')
      .isLength({ min: 2, max: 100 }).withMessage('Product name must be between 2 and 100 characters'),
    check('price')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    check('stock')
      .optional({ checkFalsy: true })
      .isInt({ min: 0 }).withMessage('Stock must be a non-negative whole number'),
    check('description')
      .optional({ checkFalsy: true })
      .matches(onlyAlphanumericAndPunctuation).withMessage('Description contains invalid characters')
      .isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
    body().custom((_, { req }) => {
      if (req.files && req.files.length > 0 && req.files.length < 3) {
        throw new Error('Please upload at least 3 cropped images');
      }
      return true;
    }),
  ],

  // PASSWORD RULES
  resetPasswordRules: [
    check('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    check('confirm_password')
      .notEmpty().withMessage('Please confirm your password')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
  ],
  changePasswordRules: [
    check('currentPassword')
      .notEmpty().withMessage('Current password is required'),
    check('newPassword')
      .notEmpty().withMessage('New password is required')
      .isLength({ min: 8 }).withMessage('New password must be at least 8 characters long'),
    check('confirmPassword')
      .notEmpty().withMessage('Please confirm your new password')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('New passwords do not match');
        }
        return true;
      }),
  ],

  // OTP
  otpRules: [
    check('otp')
      .notEmpty().withMessage('OTP is required')
      .isNumeric().withMessage('OTP must be numeric')
      .isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 digits'),
  ],

  // EDIT PROFILE
  editProfileRules: [
    check('name')
      .optional({ checkFalsy: true })
      .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
      .matches(onlyLettersSpaces).withMessage('Name can only contain letters and spaces'),
    check('phone')
      .optional({ checkFalsy: true })
      .matches(phoneRegex).withMessage('Phone must be exactly 10 digits')
      .custom(disallowConsecutiveDigits),
  ],
};
