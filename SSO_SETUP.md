# SSO (Single Sign-On) Setup Guide

This guide will help you set up Google and Facebook OAuth for your application.

## Prerequisites

Make sure you have the following packages installed:
```bash
npm install passport passport-google-oauth20 passport-facebook
```

## Environment Variables

Add the following variables to your `.env` file:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Facebook OAuth Configuration
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# Session Secret (update your existing one)
SESSION_SECRET=your_session_secret_key
```

## Google OAuth Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" and create an OAuth 2.0 Client ID
5. Set the authorized redirect URI to: `http://localhost:3000/auth/google/callback`
6. Copy the Client ID and Client Secret to your `.env` file

## Facebook OAuth Setup

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or select an existing one
3. Add Facebook Login product to your app
4. Go to Settings > Basic and copy the App ID and App Secret
5. Go to Facebook Login > Settings and add the redirect URI: `http://localhost:3000/auth/facebook/callback`
6. Copy the App ID and App Secret to your `.env` file

## Features Implemented

### User Model Updates
- Added `googleId`, `facebookId`, `profilePicture`, and `provider` fields
- Made `password` and `mobile` optional for SSO users
- Users are automatically verified when signing up via SSO

### Authentication Flow
- Users can sign up/login with Google or Facebook
- Existing users with the same email can link their SSO accounts
- SSO users are automatically verified and redirected to the shop
- Proper session management with passport

### UI Updates
- Added SSO buttons to both login and signup pages
- Modern, responsive design with proper styling
- Clear separation between traditional and SSO authentication

## Routes Added

- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - Google OAuth callback
- `GET /auth/facebook` - Initiate Facebook OAuth
- `GET /auth/facebook/callback` - Facebook OAuth callback
- `GET /logout` - Logout user and destroy session

## Security Features

- Secure session management
- Automatic account linking for existing users
- Proper error handling for OAuth failures
- CSRF protection through session management

## Testing

1. Start your server: `npm run dev`
2. Visit `http://localhost:3000/login` or `http://localhost:3000/signup`
3. Click on "Continue with Google" or "Continue with Facebook"
4. Complete the OAuth flow
5. You should be redirected to `/shop` upon successful authentication

## Troubleshooting

- Make sure all environment variables are set correctly
- Verify that your OAuth redirect URIs match exactly
- Check that your app is properly configured in Google/Facebook developer consoles
- Ensure your domain is added to authorized domains in OAuth settings 