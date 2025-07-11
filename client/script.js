const socket = io('https://tic-tac-toe-multiplayer-git-main-tosif-shaikhs-projects.vercel.app'); // Update to Render URL after backend deployment
socket.on('connect', () => console.log('Connected to server!'));
socket.on('connect_error', (error) => console.error('Connection error:', error));
let currentPlayer = 'x';
let board = ['', '', '', '', '', '', '', '', ''];
let gameActive = true;
let isComputerMode = false;
let playerName = '';
let roomCode = '';
let playerSymbol = '';

const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function createRoom() {
    playerName = document.getElementById('playerName').value || 'Player 1';
    socket.emit('createRoom', playerName, (code) => {
        roomCode = code;
        document.getElementById('startScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'block';
        updateStatus(`Room ${roomCode} created. Share this code with your opponent.`);
    });
}

function joinRoom() {
    playerName = document.getElementById('playerName').value || 'Player 2';
    const code = document.getElementById('roomCode').value;
    if (code.length !== 4 || isNaN(code)) {
        alert('Please enter a valid 4-digit room code');
        return;
    }
    socket.emit('joinRoom', { roomCode: code, playerName }, (response) => {
        if (response.error) {
            alert(response.error);
            return;
        }
        roomCode = code;
        document.getElementById('startScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'block';
    });
}

function startGame(mode) {
    isComputerMode = mode === 'computer';
    playerName = document.getElementById('playerName').value || 'Player 1';
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    updateStatus();
    if (isComputerMode && currentPlayer === 'o') {
        computerMove();
    }
}

function updateStatus(message) {
    const status = document.getElementById('status');
    if (message) {
        status.textContent = message;
    } else if (isComputerMode) {
        status.textContent = currentPlayer === 'x' ? `${playerName}'s Turn (X)` : `Computer's Turn (O)`;
    } else {
        status.textContent = currentPlayer === playerSymbol ? `Your Turn (${playerSymbol.toUpperCase()})` : `Opponent's Turn`;
    }
}

function handleCellClick(event) {
    const index = event.target.dataset.index;
    if (isComputerMode) {
        if (board[index] !== '' || !gameActive || currentPlayer !== 'x') return;
        board[index] = currentPlayer;
        event.target.classList.add(currentPlayer);
        if (checkWin()) {
            document.getElementById('status').textContent = `${playerName} Wins!`;
            gameActive = false;
            highlightWinningCells();
            return;
        }
        if (board.every(cell => cell !== '')) {
            document.getElementById('status').textContent = "It's a Tie!";
            gameActive = false;
            return;
        }
        currentPlayer = 'o';
        updateStatus();
        setTimeout(computerMove, 500);
    } else {
        if (board[index] !== '' || !gameActive || currentPlayer !== playerSymbol) return;
        socket.emit('makeMove', { roomCode, index });
    }
}

socket.on('gameState', ({ board: newBoard, currentPlayer: newCurrentPlayer, players }) => {
    board = newBoard;
    currentPlayer = newCurrentPlayer;
    playerSymbol = players.find(p => p.id === socket.id)?.symbol || 'x';
    document.querySelectorAll('.cell').forEach((cell, i) => {
        cell.classList.remove('x', 'o', 'win-animation');
        if (board[i]) cell.classList.add(board[i]);
    });
    updateStatus();
});

socket.on('gameOver', ({ winner, winningCells }) => {
    gameActive = false;
    if (winner) {
        document.getElementById('status').textContent = `${winner} Wins!`;
        if (winningCells) {
            winningCells.forEach(i => {
                document.querySelector(`.cell[data-index="${i}"]`).classList.add('win-animation');
            });
        }
    } else {
        document.getElementById('status').textContent = "It's a Tie!";
    }
});

socket.on('status', (message) => {
    updateStatus(message);
});

socket.on('error', (message) => {
    alert(message);
});

function checkWin() {
    return winningCombinations.some(combination => {
        return combination.every(index => board[index] === currentPlayer);
    });
}

function highlightWinningCells() {
    winningCombinations.forEach(combination => {
        if (combination.every(index => board[index] === currentPlayer)) {
            combination.forEach(index => {
                document.querySelector(`.cell[data-index="${index}"]`).classList.add('win-animation');
            });
        }
    });
}

function computerMove() {
    let bestScore = -Infinity;
    let move;
    for (let i = 0; i < board.length; i++) {
        if (board[i] === '') {
            board[i] = 'o';
            let score = minimax(board, 0, false);
            board[i] = '';
            if (score > bestScore) {
                bestScore = score;
                move = i;
            }
        }
    }
    board[move] = 'o';
    document.querySelector(`.cell[data-index="${move}"]`).classList.add('o');
    if (checkWin()) {
        document.getElementById('status').textContent = `Computer Wins!`;
        gameActive = false;
        highlightWinningCells();
        return;
    }
    if (board.every(cell => cell !== '')) {
        document.getElementById('status').textContent = "It's a Tie!";
        gameActive = false;
        return;
    }
    currentPlayer = 'x';
    updateStatus();
}

function minimax(board, depth, isMaximizing) {
    if (checkWinFor('o')) return 10 - depth;
    if (checkWinFor('x')) return depth - 10;
    if (board.every(cell => cell !== '')) return 0;

    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < board.length; i++) {
            if (board[i] === '') {
                board[i] = 'o';
                let score = minimax(board, depth + 1, false);
                board[i] = '';
                bestScore = Math.max(score, bestScore);
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < board.length; i++) {
            if (board[i] === '') {
                board[i] = 'x';
                let score = minimax(board, depth + 1, true);
                board[i] = '';
                bestScore = Math.min(score, bestScore);
            }
        }
        return bestScore;
    }
}

function checkWinFor(player) {
    return winningCombinations.some(combination => {
        return combination.every(index => board[index] === player);
    });
}

function resetGame() {
    board = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = 'x';
    gameActive = true;
    isComputerMode = false;
    roomCode = '';
    playerSymbol = '';
    document.querySelectorAll('.cell').forEach(cell => {
        cell.classList.remove('x', 'o', 'win-animation');
    });
    document.getElementById('startScreen').style.display = 'flex';
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('playerName').value = '';
    document.getElementById('roomCode').value = '';
}

document.querySelectorAll('.cell').forEach(cell => {
    cell.addEventListener('click', handleCellClick);
});
