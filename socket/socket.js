const { Server } = require('socket.io');

module.exports = (server, app) => {
	const io = new Server(server);
	const userSockets = new Map();

	if (app) {
		app.set('io', io);
		app.set('userSockets', userSockets);
	}

	io.on('connection', (socket) => {
		console.log('New client connected', socket.id);

		socket.on('user_login', (userId) => {
			if (userId) {
				userSockets.set(userId.toString(), socket.id);
				console.log(`User ${userId} registered with socket ${socket.id}`);
			}
		});

		socket.on('registerUser', (userId) => {
			if (userId) {
				userSockets.set(userId.toString(), socket.id);
				console.log(`User ${userId} registered with socket ${socket.id}`);
			}
		});

		socket.on('user_logout', (userId) => {
			if (userId) {
				userSockets.delete(userId.toString());
				console.log(`User ${userId} logged out manually`);
			}
		});

		socket.on('disconnect', () => {
			for (const [userId, socketId] of userSockets.entries()) {
				if (socketId === socket.id) {
					userSockets.delete(userId);
					console.log(`User ${userId} disconnected`);
					break;
				}
			}
		});
	});
};
