
const path = require('path');
const { validationResult } = require('express-validator');
const { STATUS_CODES, MESSAGES } = require('../utils/constants');

const validator = (schemaName) => {
  return async (req, res, next) => {
    try {
     
      const validationRules = require(path.join(__dirname, 'validationRules'))[schemaName];

      if (!validationRules || !Array.isArray(validationRules) || validationRules.length === 0) {
        return next();
      }

      await Promise.all(validationRules.map(rule => rule.run(req)));

     
      const errors = validationResult(req);
      req.validationErrors = null;

      if (!errors.isEmpty()) {
        req.validationErrors = {};
        errors.array().forEach(err => {
          if (!req.validationErrors[err.path]) {
            req.validationErrors[err.path] = [];
          }
          req.validationErrors[err.path].push(err.msg);
        });

        
        const wantsJson = (
          req.xhr === true ||
          req.get('X-Requested-With') === 'XMLHttpRequest' ||
          (req.get('Accept') && req.get('Accept').split(',')[0].trim() === 'application/json') ||
          (typeof req.is === 'function' && req.is('application/json'))
        );

        if (wantsJson) {
          return res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            errors: req.validationErrors
          });
        }

        return next(); 
      }

      next();
    } catch (err) {
      console.error('Validation middleware error:', err);
      req.validationErrors = { general: ['Validation system error'] };
      next();
    }
  };
};

module.exports = validator;
