const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const User = require('../models/user'); 

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL}/auth/google/callback`
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // this check if the user already is there or it exists with the google id
      const existingUser = await User.findOne({ googleId: profile.id });
      if (existingUser) {
        if (existingUser.isBlocked) {
          return done(null, false, { message: 'Your account has been blocked by the admin.' });
        }
        console.log('Found existing user with Google ID:', existingUser.email);
        await existingUser.updateLoginInfo();
        await existingUser.save();
        return done(null, existingUser);
      }

      // this check if the user already is there or it exists with the email
      const emailUser = await User.findOne({ email: profile.emails?.[0]?.value });
      if (emailUser && profile.emails?.[0]?.value) {
        if (emailUser.isBlocked) {
          return done(null, false, { message: 'Your account has been blocked by the admin.' });
        }
        console.log('Found existing user with email, linking Google account:', emailUser.email);
        emailUser.googleId = profile.id;
        emailUser.isVerified = true;
        emailUser.addAuthProvider('google');
        await emailUser.updateLoginInfo();
        await emailUser.save();
        return done(null, emailUser);
      }

      // here we create a new user
      console.log('Creating new user with Google OAuth...');
      const newUser = new User({
        googleId: profile.id,
        name: profile.displayName,
        email: profile.emails?.[0]?.value || '',
        mobile: profile.phoneNumbers?.[0]?.value || null,
        profilePicture: profile.photos?.[0]?.value || '',
        isVerified: true,
        authProvider: ['google'],
        lastLogin: new Date(),
        loginCount: 1
      });

      await newUser.save();
      console.log('New user saved successfully:', newUser.email);
      done(null, newUser);

    } catch (err) {
      console.error('Google OAuth error:', err);
      done(err, null);
    }
  }
));


passport.serializeUser((user, done) => {
  try {
    done(null, user._id);
  } catch (err) {
    done(err, null);
  }
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    if (!user) {
      return done(new Error('User not found'), null);
    }
    done(null, user);
  } catch (err) {
    console.error('Passport deserialize error:', err);
    done(err, null);
  }
});

module.exports = passport;