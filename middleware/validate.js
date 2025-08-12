// middleware/validate.js
const path = require('path');
const { validationResult } = require('express-validator');

const validator = (schemaName) => {
  return async (req, res, next) => {
    try {
      // Dynamically load validation rules
      const validationRules = require(path.join(__dirname, 'validationRules'))[schemaName];

      if (!validationRules || !Array.isArray(validationRules) || validationRules.length === 0) {
        return next(); // No rules found → skip validation
      }

      // Run all validation checks
      await Promise.all(validationRules.map(rule => rule.run(req)));

      // Gather validation results
      const errors = validationResult(req);
      req.validationErrors = {};

      if (!errors.isEmpty()) {
        errors.array().forEach(err => {
          if (!req.validationErrors[err.path]) {
            req.validationErrors[err.path] = [];
          }
          req.validationErrors[err.path].push(err.msg);
        });

        // If request expects JSON, send structured error response
        if (req.xhr || req.accepts('json')) {
          return res.status(400).json({
            success: false,
            errors: req.validationErrors
          });
        }

        return next(); // Pass errors to route handler if not JSON
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
