# Environment Setup Guide

## 🔧 **Required Environment Variables**

Create a `.env` file in your project root with the following variables:

```env
# Database Configuration
MONGODB_URI=mongodb://127.0.0.1:27017/capturecore

# Session Configuration (REQUIRED)
SESSION_SECRET=your_super_secret_session_key_change_this_in_production

# Google OAuth Configuration (REQUIRED for Google login)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Email Configuration (for OTP)
EMAIL_USER=capturecore792@gmail.com
EMAIL_PASS=your_email_app_password_here

# Server Configuration
PORT=3000
NODE_ENV=development
```

## 🚀 **Google OAuth Setup**

### 1. **Create Google OAuth Credentials**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Google+ API** or **Google Identity API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Set **Application Type** to "Web application"
6. Add **Authorized redirect URIs**:
   - `http://localhost:3000/auth/google/callback` (for development)
   - `https://yourdomain.com/auth/google/callback` (for production)
7. Copy the **Client ID** and **Client Secret**

### 2. **Update Your .env File**

Replace the placeholder values:
```env
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_actual_secret_here
```

## 🔐 **Session Secret**

Generate a strong session secret:
```bash
# Option 1: Use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: Use online generator
# Visit: https://generate-secret.vercel.app/32
```

## 📧 **Email Setup (Optional)**

For OTP functionality, set up Gmail App Password:
1. Enable 2-factor authentication on your Gmail
2. Generate an App Password
3. Use that password in `EMAIL_PASS`

## ✅ **Testing the Fix**

1. **Create the .env file** with the above variables
2. **Restart your server**: `npm run dev`
3. **Test Google OAuth**:
   - Go to `http://localhost:3000/login`
   - Click "Continue with Google"
   - Complete the OAuth flow

## 🐛 **Common Issues & Solutions**

### **Issue 1: "Invalid Credentials"**
- ✅ Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- ✅ Verify redirect URI matches exactly in Google Console

### **Issue 2: "Session Secret Required"**
- ✅ Ensure `SESSION_SECRET` is set in `.env`
- ✅ Restart server after adding environment variables

### **Issue 3: "Redirect URI Mismatch"**
- ✅ Add `http://localhost:3000/auth/google/callback` to Google Console
- ✅ Check for typos in the callback URL

### **Issue 4: "User Not Found"**
- ✅ Check MongoDB connection
- ✅ Verify User model has `googleId` field

## 🔍 **Debug Commands**

```bash
# Check if environment variables are loaded
node -e "require('dotenv').config(); console.log('SESSION_SECRET:', process.env.SESSION_SECRET ? 'SET' : 'NOT SET')"

# Test MongoDB connection
node -e "const mongoose = require('mongoose'); mongoose.connect('mongodb://127.0.0.1:27017/capturecore').then(() => console.log('DB Connected')).catch(console.error)"
```

## 🚨 **Security Notes**

- **Never commit `.env` file** to version control
- **Use strong session secrets** in production
- **Enable HTTPS** in production
- **Set secure cookies** in production environment 