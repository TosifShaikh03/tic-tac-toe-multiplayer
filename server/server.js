const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: 'http://localhost:5500',
        methods: ['GET', 'POST'],
    },
});

const PORT = 3000;

const rooms = new Map();

function generateRoomCode() {
    let code;
    do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
    } while (rooms.has(code));
    return code;
}

app.use(cors());
app.get('/', (req, res) => {
    res.send('Tic-Tac-Toe Server');
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('createRoom', (playerName, callback) => {
        const roomCode = generateRoomCode();
        rooms.set(roomCode, {
            players: [{ id: socket.id, name: playerName, symbol: 'x' }],
            board: ['', '', '', '', '', '', '', '', ''],
            currentPlayer: 'x',
        });
        socket.join(roomCode);
        callback(roomCode);
        socket.emit('status', `${playerName} created room ${roomCode}. Waiting for opponent...`);
    });

    socket.on('joinRoom', ({ roomCode, playerName }, callback) => {
        const room = rooms.get(roomCode);
        if (!room) {
            callback({ error: 'Room not found' });
            return;
        }
        if (room.players.length >= 2) {
            callback({ error: 'Room is full' });
            return;
        }
        room.players.push({ id: socket.id, name: playerName, symbol: 'o' });
        socket.join(roomCode);
        callback({ success: true });
        io.to(roomCode).emit('status', `${playerName} joined. Game starting!`);
        io.to(roomCode).emit('gameState', {
            board: room.board,
            currentPlayer: room.currentPlayer,
            players: room.players,
        });
    });

    socket.on('makeMove', ({ roomCode, index }) => {
        const room = rooms.get(roomCode);
        if (!room || room.board[index] !== '' || room.currentPlayer !== room.players.find(p => p.id === socket.id).symbol) {
            socket.emit('error', 'Invalid move');
            return;
        }
        room.board[index] = room.currentPlayer;
        room.currentPlayer = room.currentPlayer === 'x' ? 'o' : 'x';
        io.to(roomCode).emit('gameState', {
            board: room.board,
            currentPlayer: room.currentPlayer,
            players: room.players,
        });

        const winningCombinations = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        const winner = winningCombinations.find(combo => {
            return combo.every(i => room.board[i] === room.players[0].symbol) ||
                   combo.every(i => room.board[i] === room.players[1].symbol);
        });
        if (winner) {
            const winningSymbol = room.board[winner[0]];
            const winnerName = room.players.find(p => p.symbol === winningSymbol).name;
            io.to(roomCode).emit('gameOver', { winner: winnerName, winningCells: winner });
            rooms.delete(roomCode);
            return;
        }
        if (room.board.every(cell => cell !== '')) {
            io.to(roomCode).emit('gameOver', { winner: null });
            rooms.delete(roomCode);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (const [roomCode, room] of rooms) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                io.to(roomCode).emit('status', 'Opponent disconnected. Game ended.');
                rooms.delete(roomCode);
                break;
            }
        }
    });
});

const express = require('express');
const { Server } = require('socket.io');

const app = express();

module.exports = (req, res) => {
    if (!res.socket.server.io) {
        const io = new Server(res.socket.server, {
            cors: {
                origin: '*',
                methods: ['GET', 'POST'],
                credentials: true
            }
        });

        const rooms = new Map(); // Store room data: { roomId: { board, players, currentPlayer } }

        io.on('connection', (socket) => {
            console.log('New client connected:', socket.id);

            socket.on('createRoom', () => {
                const roomId = `room-${Math.random().toString(36).slice(2, 9)}`;
                rooms.set(roomId, {
                    board: Array(9).fill(''),
                    players: [socket.id],
                    currentPlayer: 'X'
                });
                socket.join(roomId);
                socket.emit('roomCreated', roomId);
                console.log(`Room created: ${roomId}`);
            });

            socket.on('move', ({ roomId, index }) => {
                const room = rooms.get(roomId);
                if (!room || !room.players.includes(socket.id)) return;
                if (room.board[index] === '' && room.players.length === 2) {
                    room.board[index] = room.currentPlayer;
                    io.to(roomId).emit('move', { index, player: room.currentPlayer });
                    if (checkWin(room.board)) {
                        io.to(roomId).emit('win', room.currentPlayer);
                        room.board = Array(9).fill('');
                    } else if (room.board.every(cell => cell !== '')) {
                        io.to(roomId).emit('draw');
                        room.board = Array(9).fill('');
                    } else {
                        room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
                    }
                }
            });

            socket.on('reset', (roomId) => {
                const room = rooms.get(roomId);
                if (room) {
                    room.board = Array(9).fill('');
                    room.currentPlayer = 'X';
                    io.to(roomId).emit('reset');
                }
            });

            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
                rooms.forEach((room, roomId) => {
                    room.players = room.players.filter(id => id !== socket.id);
                    if (room.players.length === 0) {
                        rooms.delete(roomId);
                    }
                });
            });

            // Auto-join an available room
            let joined = false;
            for (const [roomId, room] of rooms) {
                if (room.players.length === 1) {
                    room.players.push(socket.id);
                    socket.join(roomId);
                    socket.emit('player', room.players.length === 1 ? 'X' : 'O');
                    io.to(roomId).emit('start');
                    joined = true;
                    break;
                }
            }
            if (!joined && rooms.size > 0) {
                socket.emit('status', 'All rooms are full');
                socket.disconnect();
            }
        });

        function checkWin(board) {
            const wins = [
                [0, 1, 2], [3, 4, 5], [6, 7, 8],
                [0, 3, 6], [1, 4, 7], [2, 5, 8],
                [0, 4, 8], [2, 4, 6]
            ];
            return wins.some(combo => combo.every(i => board[i] === board[combo[0]] && board[i] !== ''));
        }

        res.socket.server.io = io;
    }
    res.status(200).end();
};

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
