
const socket = io();

if (typeof userId !== 'undefined' && userId) {
    socket.emit('user_login', userId);
}


socket.on('force_logout', (data) => {
    console.log('Force logout received:', data);
    
    
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Account Blocked',
            text: data.message || 'Your account has been blocked by admin.',
            icon: 'error',
            confirmButtonText: 'OK'
        }).then(() => {
           
            window.location.href = '/login?error=user_blocked';
        });
    } else {
       
        alert('Your account has been blocked by admin.');
        window.location.href = '/login?error=user_blocked';
    }
});

function logout() {
    if (typeof userId !== 'undefined' && userId) {
        socket.emit('user_logout', userId);
    }
}

window.addEventListener('beforeunload', () => {
    if (typeof userId !== 'undefined' && userId) {
        socket.emit('user_logout', userId);
    }
}); 