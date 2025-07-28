# Admin Session Handling Setup Guide

This guide covers the implementation of secure session handling for the admin panel with role-based access control and security features.

## Features Implemented

### 🔐 **Secure Authentication**
- Password hashing with bcrypt
- Account lockout after 5 failed attempts (2-hour lockout)
- Session expiry (8 hours)
- Secure session management

### 👥 **Role-Based Access Control**
- **Super Admin**: Full access to all features
- **Admin**: Standard admin privileges
- **Moderator**: Limited access (user management, analytics)

### 🛡️ **Security Features**
- Session validation on every request
- Automatic session refresh
- Activity logging
- Permission-based route protection
- CSRF protection through session management

### 📊 **Admin Management**
- Profile management (update name, email)
- Password change functionality
- Account statistics and activity tracking
- Permission management

## Setup Instructions

### 1. **Create Initial Admin Users**

Run the following command to create the initial admin users:

```bash
npm run create-admin
```

This will create:
- **Super Admin**: `admin@capturecore.com` / `Admin@123`
- **Moderator**: `moderator@capturecore.com` / `Moderator@123`

### 2. **Environment Variables**

Add these to your `.env` file:

```env
# Session Configuration
SESSION_SECRET=your_very_secure_session_secret_key
SESSION_MAX_AGE=28800000  # 8 hours in milliseconds

# Database
MONGODB_URI=your_mongodb_connection_string
```

### 3. **Database Schema**

The admin model includes:
- `name`, `email`, `password` (hashed)
- `role` (super_admin, admin, moderator)
- `isActive` (account status)
- `permissions` (array of allowed actions)
- `loginAttempts`, `lockUntil` (security features)
- `lastLogin`, `profilePicture`

## Usage

### **Login Flow**
1. Admin visits `/admin/login`
2. Enters credentials
3. System validates password and checks account status
4. If successful, creates session with admin data
5. Redirects to dashboard

### **Session Management**
- Sessions automatically refresh on each request
- Sessions expire after 8 hours of inactivity
- Failed login attempts are tracked and can lock accounts

### **Permission System**

Available permissions:
- `manage_users` - User management (block/unblock, view)
- `manage_products` - Product CRUD operations
- `manage_categories` - Category management
- `view_analytics` - Access to analytics and reports
- `manage_orders` - Order management (future feature)

### **Route Protection**

Routes are protected using middleware:

```javascript
// Basic admin authentication
router.get('/dashboard', adminAuth, adminControllers.dashboard);

// Permission-based protection
router.get('/users', adminAuth, requirePermission('manage_users'), adminControllers.getUsers);

// Role-based protection
router.get('/admin-only', adminAuth, requireRole('admin'), adminControllers.adminOnly);
```

## API Endpoints

### **Authentication**
- `GET /admin/login` - Login page
- `POST /admin/login` - Authenticate admin
- `GET /admin/logout` - Logout and destroy session

### **Profile Management**
- `GET /admin/profile` - View admin profile
- `POST /admin/profile/update` - Update profile information
- `POST /admin/profile/change-password` - Change password

### **User Management**
- `GET /admin/users` - List all users (requires `manage_users` permission)
- `POST /admin/users/:id/block` - Block user
- `POST /admin/users/:id/unblock` - Unblock user

### **Dashboard**
- `GET /admin/dashboard` - Admin dashboard with statistics

## Security Best Practices

### **Session Security**
- Sessions are stored server-side
- Session IDs are cryptographically secure
- Sessions expire automatically
- Session data is cleared on logout

### **Password Security**
- Passwords are hashed using bcrypt (salt rounds: 10)
- Account lockout prevents brute force attacks
- Password change requires current password verification

### **Access Control**
- All admin routes require authentication
- Permission-based access control
- Role-based restrictions
- Activity logging for audit trails

## Error Handling

### **Common Error Scenarios**
- **Invalid credentials**: Returns to login with error message
- **Account locked**: Shows lockout message with duration
- **Insufficient permissions**: Shows access denied page
- **Session expired**: Redirects to login

### **Error Pages**
- Access denied page (`/views/admin/error.ejs`)
- Proper error messages for different scenarios
- User-friendly error handling

## Monitoring and Logging

### **Activity Logging**
- All admin actions are logged
- Login attempts (successful and failed)
- Profile updates and password changes
- User management actions

### **Session Monitoring**
- Session creation and destruction
- Session refresh tracking
- Failed authentication attempts

## Troubleshooting

### **Common Issues**

1. **Admin can't login**
   - Check if account is active
   - Verify account isn't locked
   - Ensure correct credentials

2. **Session expires too quickly**
   - Check session configuration
   - Verify session middleware is working
   - Check for session conflicts

3. **Permission errors**
   - Verify admin has required permissions
   - Check role assignments
   - Ensure middleware is properly configured

### **Debug Commands**

```bash
# Check admin users in database
mongo
use capturecore
db.admins.find()

# Reset admin password (if needed)
db.admins.updateOne(
  {email: "admin@capturecore.com"},
  {$set: {password: "new_hashed_password"}}
)
```

## Production Considerations

### **Security Enhancements**
- Use HTTPS in production
- Implement rate limiting
- Add IP-based restrictions
- Enable audit logging
- Regular security updates

### **Performance**
- Session store optimization
- Database indexing
- Caching strategies
- Load balancing considerations

### **Backup and Recovery**
- Regular database backups
- Session data backup
- Disaster recovery procedures
- User data protection

## Testing

### **Manual Testing**
1. Login with correct credentials
2. Test session persistence
3. Verify permission restrictions
4. Test account lockout
5. Check session expiry

### **Automated Testing**
- Unit tests for authentication
- Integration tests for sessions
- Permission testing
- Security testing

This implementation provides a robust, secure, and scalable admin session management system with proper access control and monitoring capabilities. 