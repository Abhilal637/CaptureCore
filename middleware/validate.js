// middleware/validate.js
const { validationResult } = require('express-validator');

const validator = (schemaName) => {
  return async (req, res, next) => {
    try {
      // Get validation rules for the schema
      const validationRules = require('./validationRules')[schemaName];
      
      if (!validationRules) {
        return next();
      }

      // Run all validation rules
      await Promise.all(validationRules.map(validation => validation.run(req)));

      // Check for validation errors
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        // Format errors for display
        const formattedErrors = {};
        errors.array().forEach(error => {
          if (!formattedErrors[error.path]) {
            formattedErrors[error.path] = [];
          }
          formattedErrors[error.path].push(error.msg);
        });

        // Store errors in request object for the controller
        req.validationErrors = formattedErrors;
        
        // For AJAX requests, return JSON
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
          return res.status(400).json({
            success: false,
            errors: formattedErrors
          });
        }
        
        // For regular requests, let the controller handle the error rendering
        // The controller should check for req.validationErrors and render the appropriate form
        return next();
      }

      next();
    } catch (error) {
      console.error('Validation error:', error);
      req.validationErrors = { general: ['Validation system error'] };
      return next();
    }
  };
};

module.exports = validator;
