# Google OAuth Setup Guide

## 1. Environment Variables Required

Create a `.env` file in your project root with the following variables:

```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/capturecore

# Server Configuration
PORT=3000
BASE_URL=http://localhost:3000

# Session Configuration
SESSION_SECRET=your_super_secret_session_key_here

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Email Configuration (for OTP)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password

# Twilio Configuration (for SMS OTP)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# File Upload Configuration
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./public/uploads
```

## 2. Google OAuth Setup Steps

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API

### Step 2: Create OAuth 2.0 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Add authorized redirect URIs:
   - `http://localhost:3000/auth/google/callback` (for development)
   - `https://yourdomain.com/auth/google/callback` (for production)
5. Copy the Client ID and Client Secret

### Step 3: Update Environment Variables
Replace the placeholder values in your `.env` file:
- `GOOGLE_CLIENT_ID`: Your Google Client ID
- `GOOGLE_CLIENT_SECRET`: Your Google Client Secret
- `BASE_URL`: Your application URL (http://localhost:3000 for development)

## 3. Testing the Setup

1. Start your server: `npm run dev`
2. Navigate to your login page
3. Click on "Login with Google" button
4. You should be redirected to Google's consent screen
5. After authorization, you should be redirected back to your app

## 4. Common Issues and Solutions

### Issue: "Invalid redirect_uri"
- Make sure the redirect URI in Google Console matches exactly with your callback URL
- Check that `BASE_URL` in your `.env` file is correct

### Issue: "Client ID not found"
- Verify your `GOOGLE_CLIENT_ID` is correct
- Make sure you're using the Client ID, not the Client Secret

### Issue: "Session not persisting"
- Check that `SESSION_SECRET` is set
- Ensure session middleware is properly configured

### Issue: "User not found after login"
- Check your MongoDB connection
- Verify the User model is properly defined
- Check console logs for any errors

## 5. Security Best Practices

1. Never commit your `.env` file to version control
2. Use strong, unique session secrets
3. Set up proper CORS if needed
4. Use HTTPS in production
5. Regularly rotate your OAuth credentials

## 6. Production Deployment

For production, make sure to:
1. Update `BASE_URL` to your production domain
2. Add your production callback URL to Google Console
3. Use environment variables for all sensitive data
4. Set up proper SSL certificates
5. Configure your database for production use 