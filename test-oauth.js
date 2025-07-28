const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('./models/user');

// Load environment variables
dotenv.config();

async function testOAuthSetup() {
  console.log('🔍 Testing Google OAuth Setup...\n');

  // Test 1: Environment Variables
  console.log('1. Checking Environment Variables:');
  const requiredVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET', 
    'BASE_URL',
    'SESSION_SECRET',
    'MONGODB_URI'
  ];

  let allVarsPresent = true;
  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`   ✅ ${varName}: ${varName.includes('SECRET') ? '***SET***' : process.env[varName]}`);
    } else {
      console.log(`   ❌ ${varName}: NOT SET`);
      allVarsPresent = false;
    }
  });

  if (!allVarsPresent) {
    console.log('\n⚠️  Please set all required environment variables in your .env file');
    return;
  }

  // Test 2: Database Connection
  console.log('\n2. Testing Database Connection:');
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('   ✅ Database connected successfully');
  } catch (error) {
    console.log('   ❌ Database connection failed:', error.message);
    return;
  }

  // Test 3: User Model
  console.log('\n3. Testing User Model:');
  try {
    const testUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      googleId: 'test_google_id',
      isVerified: true,
      authProvider: ['google']
    });
    
    // Test the methods
    testUser.addAuthProvider('local');
    testUser.updateLoginInfo();
    
    console.log('   ✅ User model and methods working correctly');
  } catch (error) {
    console.log('   ❌ User model error:', error.message);
  }

  // Test 4: OAuth URLs
  console.log('\n4. OAuth Configuration:');
  const baseUrl = process.env.BASE_URL;
  const callbackUrl = `${baseUrl}/auth/google/callback`;
  
  console.log(`   Base URL: ${baseUrl}`);
  console.log(`   Callback URL: ${callbackUrl}`);
  console.log('   ✅ OAuth URLs configured');

  // Test 5: Google Console Setup
  console.log('\n5. Google Console Setup Checklist:');
  console.log('   ⚠️  Make sure you have:');
  console.log('      - Created OAuth 2.0 credentials in Google Cloud Console');
  console.log('      - Added the callback URL to authorized redirect URIs:');
  console.log(`         ${callbackUrl}`);
  console.log('      - Enabled Google+ API');

  console.log('\n🎉 OAuth setup test completed!');
  console.log('\n📝 Next steps:');
  console.log('   1. Set up your Google OAuth credentials');
  console.log('   2. Update your .env file with the credentials');
  console.log('   3. Start your server: npm run dev');
  console.log('   4. Test the login flow');

  await mongoose.disconnect();
}

// Run the test
testOAuthSetup().catch(console.error); 