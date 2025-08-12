module.exports = (io) => {
    global.userSocket = new Map();
    global.ioi = io;

    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        socket.on("registerUser", (userId) => {
            if (userId) {
                global.userSocket.set(userId.toString(), socket.id);
                console.log(`User ${userId} registered with socket ${socket.id}`);
            }
        });

        socket.on('user_logout', (userId) => {
            global.userSocket.delete(userId.toString());
            console.log(`User ${userId} logged out manually`);
        });

        socket.on('disconnect', () => {
            for (const [userId, socketId] of global.userSocket.entries()) {
                if (socketId === socket.id) {
                    global.userSocket.delete(userId);
                    console.log(`User ${userId} disconnected`);
                    break;
                }
            }
        });
    });
};
