// HTTP Status Codes
const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
  
};


const MESSAGES = {
  // Success Messages
  SUCCESS: {
    ORDER_PLACED: 'Order placed successfully',
    ORDER_CANCELLED: 'Order cancelled successfully',
    ORDER_RETURNED: 'Order returned successfully',
    RETURN_REQUESTED: 'Return requested successfully',
    ADDRESS_ADDED: 'Address added successfully',
    ADDRESS_UPDATED: 'Address updated successfully',
    ADDRESS_DELETED: 'Address deleted successfully',
    PROFILE_UPDATED: 'Profile updated successfully',
    PASSWORD_CHANGED: 'Password changed successfully',
    EMAIL_UPDATED: 'Email updated successfully',
    OTP_SENT: 'OTP sent successfully',
    OTP_VERIFIED: 'OTP verified successfully',
    PRODUCT_ADDED: 'Product added successfully',
    PRODUCT_UPDATED: 'Product updated successfully',
    PRODUCT_DELETED: 'Product deleted successfully',
    CATEGORY_ADDED: 'Category added successfully',
    CATEGORY_UPDATED: 'Category updated successfully',
    CATEGORY_DELETED: 'Category deleted successfully',
    LOGIN_SUCCESS: 'Login successful',
    LOGOUT_SUCCESS: 'Logout successful',
    REGISTRATION_SUCCESS: 'Registration successful'
  },

  // Error Messages
  ERROR: {
    ORDER_NOT_FOUND: 'Order not found',
    PRODUCT_NOT_FOUND: 'Product not found',
    ADDRESS_NOT_FOUND: 'Address not found',
    USER_NOT_FOUND: 'User not found',
    INVALID_CREDENTIALS: 'Invalid credentials',
    INVALID_OTP: 'Invalid OTP',
    EXPIRED_OTP: 'OTP has expired',
    EMAIL_EXISTS: 'Email already exists',
    PHONE_EXISTS: 'Phone number already exists',
    INSUFFICIENT_STOCK: 'Insufficient stock available',
    ORDER_NOT_ELIGIBLE_FOR_RETURN: 'Order is not eligible for return',
    ITEM_ALREADY_RETURNED: 'Item already returned or return requested',
    ITEM_ALREADY_CANCELLED: 'Item already cancelled',
    INVALID_FILE_TYPE: 'Invalid file type',
    FILE_TOO_LARGE: 'File size too large',
    SERVER_ERROR: 'Server error occurred',
    NETWORK_ERROR: 'Network error. Please try again.',
    VALIDATION_ERROR: 'Validation failed',
    UNAUTHORIZED_ACCESS: 'Unauthorized access',
    SESSION_EXPIRED: 'Session expired. Please login again.',
    PAYMENT_FAILED: 'Payment failed',
    STOCK_UNAVAILABLE: 'Product is out of stock'
  },

  // Validation Messages
  VALIDATION: {
    REQUIRED_FIELD: 'This field is required',
    INVALID_EMAIL: 'Please enter a valid email address',
    INVALID_PHONE: 'Phone number must be exactly 10 digits',
    INVALID_PINCODE: 'Pincode must be exactly 6 digits',
    PHONE_SAME_DIGITS: 'Phone number cannot have all digits the same',
    PASSWORD_MISMATCH: 'Passwords do not match',
    PASSWORD_TOO_SHORT: 'Password must be at least 6 characters',
    INVALID_QUANTITY: 'Invalid quantity',
    QUANTITY_EXCEEDS_STOCK: 'Quantity exceeds available stock',
    RETURN_REASON_REQUIRED: 'Please provide a return reason',
    CANCEL_REASON_REQUIRED: 'Please provide a cancel reason'
  }
};

const ORDER_STATUS = {
  PLACED: 'Placed',
  CONFIRMED: 'Confirmed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return Requested',
  RETURNED: 'Returned'
};

const PAYMENT_STATUS = {
  PENDING: 'Pending',
  PAID: 'Paid',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded'
};


const PAYMENT_METHODS = {
  COD: 'COD',
  ONLINE: 'ONLINE'
};

// File Upload
const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
  UPLOAD_PATH: 'public/uploads/'
};


const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100
};


const SESSION = {
  MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
  ADMIN_MAX_AGE: 12 * 60 * 60 * 1000 // 12 hours
};

module.exports = {
  STATUS_CODES,
  MESSAGES,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  FILE_UPLOAD,
  PAGINATION,
  SESSION
}; 