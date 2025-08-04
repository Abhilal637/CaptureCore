// Socket.io client for real-time logout
const socket = io();

// When user logs in, register their socket connection
if (typeof userId !== 'undefined' && userId) {
    socket.emit('user_login', userId);
}

// Listen for force logout event from admin
socket.on('force_logout', (data) => {
    console.log('Force logout received:', data);
    
    // Show notification to user
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Account Blocked',
            text: data.message || 'Your account has been blocked by admin.',
            icon: 'error',
            confirmButtonText: 'OK'
        }).then(() => {
            // Redirect to login page
            window.location.href = '/login?error=user_blocked';
        });
    } else {
        // Fallback if SweetAlert is not available
        alert('Your account has been blocked by admin.');
        window.location.href = '/login?error=user_blocked';
    }
});

// When user logs out, remove their socket connection
function logout() {
    if (typeof userId !== 'undefined' && userId) {
        socket.emit('user_logout', userId);
    }
}

// Listen for page unload to clean up socket
window.addEventListener('beforeunload', () => {
    if (typeof userId !== 'undefined' && userId) {
        socket.emit('user_logout', userId);
    }
}); 