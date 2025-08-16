
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
      req.validationErrors = {};

      if (!errors.isEmpty()) {
        errors.array().forEach(err => {
          if (!req.validationErrors[err.path]) {
            req.validationErrors[err.path] = [];
          }
          req.validationErrors[err.path].push(err.msg);
        });

        
        if (req.xhr || req.accepts('json')) {
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
