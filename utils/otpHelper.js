
exports.generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
exports.generateOrderId = () => {
  const prefix = 'ORD';
  const timestamp = Date.now(); // current timestamp
  const randomPart = Math.floor(1000 + Math.random() * 9000); 
  return `${prefix}-${timestamp}-${randomPart}`; // e.g. ORD-1722848503982-7241
};

