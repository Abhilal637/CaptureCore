const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const phoneRegex = /^\d{10,15}$/;
const nameRegex = /^[A-Za-z\s]{2,50}$/;
const productNameRegex = /^[A-Za-z0-9\s]{3,}$/;

module.exports = function (type) {
  return (req, res, next) => {
    const { name, email, phone, password, confirm_password, price, stock, description } = req.body;

    switch (type) {
      // === USER VALIDATION ===
      case 'signup':
        if (!name || !nameRegex.test(name)) {
          return res.render('user/signup', {
            error: 'Please enter a valid name.',
            name, email, phone
          });
        }
        if (!email || !emailRegex.test(email)) {
          return res.render('user/signup', {
            error: 'Please enter a valid email.',
            name, email, phone
          });
        }
        if (!phone || !phoneRegex.test(phone)) {
          return res.render('user/signup', {
            error: 'Invalid phone number.',
            name, email, phone
          });
        }
        if (!password || !passwordRegex.test(password)) {
          return res.render('user/signup', {
            error: 'Password must contain at least 8 characters, a letter and a number.',
            name, email, phone
          });
        }
        if (password !== confirm_password) {
          return res.render('user/signup', {
            error: 'Passwords do not match.',
            name, email, phone
          });
        }
        break;

      case 'login':
        if (!email || !emailRegex.test(email)) {
          return res.render('user/login', { error: 'Please enter a valid email.' });
        }
        if (!password || !passwordRegex.test(password)) {
          return res.render('user/login', {
            error: 'Password must be at least 8 characters, including a letter and a number.'
          });
        }
        break;

      case 'reset':
        if (!password || !passwordRegex.test(password)) {
          return res.render('user/reset-password', {
            token: req.params.token,
            userId: req.body.userId,
            error: 'Password must be at least 8 characters, include a letter and a number.'
          });
        }
        break;

      // === ADMIN VALIDATION ===
      case 'adminLogin':
        if (!email || !emailRegex.test(email)) {
          return res.status(400).send('Invalid admin email');
        }
        if (!password || password.length < 4) {
          return res.status(400).send('Invalid admin password');
        }
        break;

      case 'addCategory':
      case 'editCategory':
        if (!name || !nameRegex.test(name)) {
          return res.status(400).send('Invalid category name');
        }
        break;

      case 'addProduct':
      case 'editProduct':
        if (!name || !productNameRegex.test(name)) {
          return res.status(400).send('Invalid product name');
        }
        if (!description || description.length < 5) {
          return res.status(400).send('Description is too short');
        }
        if (!price || isNaN(price)) {
          return res.status(400).send('Invalid price');
        }
        if (!stock || isNaN(stock)) {
          return res.status(400).send('Invalid stock value');
        }
        break;

      default:
        break;
    }

    next();
  };
};
