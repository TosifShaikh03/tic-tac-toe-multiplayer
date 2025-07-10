const socket = io('https://github.com/TosifShaikh03/tic-tac-toe-multiplayer/tree/main', {
    transports: ['websocket', 'polling'] // Prefer WebSocket, fallback to polling
});

const cells = document.querySelectorAll('.cell');
const status = document.getElementById('status');
const resetButton = document.getElementById('reset');
const createRoomButton = document.getElementById('create-room');
let currentPlayer = null;
let roomId = null;

// Debug Socket.IO connection
socket.on('connect', () => {
    console.log('Successfully connected to Socket.IO server');
});

socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error);
});

// Create a new room
function createRoom() {
    socket.emit('createRoom');
}

createRoomButton.addEventListener('click', createRoom);

// Handle room creation
socket.on('roomCreated', (id) => {
    roomId = id;
    status.textContent = `Room ${roomId} created. Waiting for opponent...`;
});

// Assign player (X or O)
socket.on('player', (player) => {
    currentPlayer = player;
    status.textContent = `You are ${player} in room ${roomId}. Waiting for opponent...`;
});

// Start the game
socket.on('start', () => {
    status.textContent = `Your turn (${currentPlayer})`;
});

// Handle moves
socket.on('move', ({ index, player }) => {
    cells[index].textContent = player;
    status.textContent = `${player === currentPlayer ? 'Your turn' : "Opponent's turn"}`;
});

// Handle win
socket.on('win', (player) => {
    status.textContent = `${player} wins!`;
    cells.forEach(cell => cell.style.pointerEvents = 'none');
});

// Handle draw
socket.on('draw', () => {
    status.textContent = "It's a draw!";
});

// Cell click to make a move
cells.forEach(cell => {
    cell.addEventListener('click', () => {
        const index = cell.getAttribute('data-index');
        socket.emit('move', { roomId, index });
    });
});

// Reset game
resetButton.addEventListener('click', () => {
    socket.emit('reset', roomId);
});

// Handle reset
socket.on('reset', () => {
    cells.forEach(cell => {
        cell.textContent = '';
        cell.style.pointerEvents = 'auto';
    });
    status.textContent = `Your turn (${currentPlayer})`;
});

// Handle game full or errors
socket.on('status', (message) => {
    status.textContent = message;
});
