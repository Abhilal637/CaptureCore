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

      
      await Promise.all(validationRules.map(validation => validation.run(req)));

     
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
       
        const formattedErrors = {};
        errors.array().forEach(error => {
          if (!formattedErrors[error.path]) {
            formattedErrors[error.path] = [];
          }
          formattedErrors[error.path].push(error.msg);
        });

      
        req.validationErrors = formattedErrors;
        
       
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
          return res.status(400).json({
            success: false,
            errors: formattedErrors
          });
        }
        
       
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
