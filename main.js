import { Chess } from 'chess.js';
import { chessPieces } from './pieces.js';
import { MistakeAnalysis } from './mistakeAnalysis.js';

class ChessBoard {
    constructor() {
        this.chess = new Chess();
        this.board = document.getElementById('chess-board');
        this.selectedSquare = null;
        this.legalMoves = [];
        this.orientation = 'white';
        this.moveHistory = [];
        this.currentMoveIndex = -1;
        this.draggedPiece = null;
        this.draggedFrom = null;
        
        this.pieces = chessPieces;
        
        this.init();
        // Initialize move history with starting position
        this.initializeMoveHistory();
    }
    
    initializeMoveHistory() {
        this.moveHistory = [{
            fen: this.chess.fen(),
            move: null,
            san: 'Starting position'
        }];
        this.currentMoveIndex = 0;
    }
    
    init() {
        this.renderBoard();
        this.renderCoordinates();
        this.setupEventListeners();
        this.updatePosition();
        this.updateAnalysisInfo();
    }
    
    renderBoard() {
        this.board.innerHTML = '';
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                const file = String.fromCharCode(97 + col);
                const rank = 8 - row;
                const squareName = this.orientation === 'white' 
                    ? `${file}${rank}` 
                    : `${String.fromCharCode(97 + (7 - col))}${row + 1}`;
                
                square.className = 'square';
                square.classList.add((row + col) % 2 === 0 ? 'light' : 'dark');
                square.dataset.square = squareName;
                square.dataset.row = row;
                square.dataset.col = col;
                
                square.addEventListener('click', (e) => this.handleSquareClick(e));
                square.addEventListener('dragover', (e) => this.handleDragOver(e));
                square.addEventListener('drop', (e) => this.handleDrop(e));
                
                this.board.appendChild(square);
            }
        }
    }
    
    renderCoordinates() {
        const filesDiv = document.querySelector('.files');
        const ranksDiv = document.querySelector('.ranks');
        
        filesDiv.innerHTML = '';
        ranksDiv.innerHTML = '';
        
        for (let i = 0; i < 8; i++) {
            const fileCoord = document.createElement('div');
            fileCoord.className = 'coordinate';
            fileCoord.textContent = this.orientation === 'white' 
                ? String.fromCharCode(97 + i)
                : String.fromCharCode(97 + (7 - i));
            filesDiv.appendChild(fileCoord);
            
            const rankCoord = document.createElement('div');
            rankCoord.className = 'coordinate';
            rankCoord.textContent = this.orientation === 'white' ? 8 - i : i + 1;
            ranksDiv.appendChild(rankCoord);
        }
    }
    
    updatePosition() {
        const position = this.chess.board();
        const squares = this.board.querySelectorAll('.square');
        
        squares.forEach(square => {
            square.innerHTML = '';
            const squareName = square.dataset.square;
            const piece = this.chess.get(squareName);
            
            if (piece) {
                const pieceElement = document.createElement('div');
                pieceElement.className = 'piece';
                const pieceKey = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
                pieceElement.innerHTML = this.pieces[pieceKey];
                pieceElement.draggable = true;
                pieceElement.dataset.piece = piece.type;
                pieceElement.dataset.color = piece.color;
                pieceElement.dataset.square = squareName;
                
                pieceElement.addEventListener('dragstart', (e) => this.handleDragStart(e));
                pieceElement.addEventListener('dragend', (e) => this.handleDragEnd(e));
                
                square.appendChild(pieceElement);
            }
        });
        
        this.highlightLastMove();
        this.checkForCheck();
    }
    
    handleSquareClick(e) {
        const square = e.currentTarget;
        const squareName = square.dataset.square;
        
        if (this.selectedSquare) {
            const move = this.tryMove(this.selectedSquare, squareName);
            if (move) {
                this.addMoveToHistory(move);
                this.clearSelection();
                this.updatePosition();
                this.updateMoveList();
                this.updateAnalysisInfo();
            } else {
                this.clearSelection();
                const piece = this.chess.get(squareName);
                if (piece && piece.color === this.chess.turn()) {
                    this.selectSquare(squareName);
                }
            }
        } else {
            const piece = this.chess.get(squareName);
            if (piece && piece.color === this.chess.turn()) {
                this.selectSquare(squareName);
            }
        }
    }
    
    handleDragStart(e) {
        const piece = e.target;
        const squareName = piece.dataset.square;
        const pieceData = this.chess.get(squareName);
        
        if (pieceData && pieceData.color === this.chess.turn()) {
            this.draggedPiece = piece;
            this.draggedFrom = squareName;
            piece.classList.add('dragging');
            this.selectSquare(squareName);
            
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', '');
        } else {
            e.preventDefault();
        }
    }
    
    handleDragEnd(e) {
        if (this.draggedPiece) {
            this.draggedPiece.classList.remove('dragging');
            this.draggedPiece = null;
            this.draggedFrom = null;
        }
    }
    
    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }
    
    handleDrop(e) {
        e.preventDefault();
        const square = e.currentTarget;
        const squareName = square.dataset.square;
        
        if (this.draggedFrom && this.draggedFrom !== squareName) {
            const move = this.tryMove(this.draggedFrom, squareName);
            if (move) {
                this.addMoveToHistory(move);
                this.clearSelection();
                this.updatePosition();
                this.updateMoveList();
                this.updateAnalysisInfo();
            }
        }
        
        this.clearSelection();
    }
    
    selectSquare(squareName) {
        this.clearSelection();
        this.selectedSquare = squareName;
        
        const square = this.board.querySelector(`[data-square="${squareName}"]`);
        if (square) {
            square.classList.add('selected');
        }
        
        this.legalMoves = this.chess.moves({ square: squareName, verbose: true });
        this.highlightLegalMoves();
    }
    
    clearSelection() {
        this.board.querySelectorAll('.square').forEach(square => {
            square.classList.remove('selected', 'legal-move', 'capture-move');
        });
        this.selectedSquare = null;
        this.legalMoves = [];
    }
    
    highlightLegalMoves() {
        this.legalMoves.forEach(move => {
            const square = this.board.querySelector(`[data-square="${move.to}"]`);
            if (square) {
                if (move.captured) {
                    square.classList.add('capture-move');
                } else {
                    square.classList.add('legal-move');
                }
            }
        });
    }
    
    highlightLastMove() {
        this.board.querySelectorAll('.square').forEach(square => {
            square.classList.remove('last-move-from', 'last-move-to');
        });
        
        const history = this.chess.history({ verbose: true });
        if (history.length > 0) {
            const lastMove = history[history.length - 1];
            const fromSquare = this.board.querySelector(`[data-square="${lastMove.from}"]`);
            const toSquare = this.board.querySelector(`[data-square="${lastMove.to}"]`);
            
            if (fromSquare) fromSquare.classList.add('last-move-from');
            if (toSquare) toSquare.classList.add('last-move-to');
        }
    }
    
    checkForCheck() {
        this.board.querySelectorAll('.check-indicator').forEach(el => el.remove());
        
        if (this.chess.inCheck()) {
            const turn = this.chess.turn();
            const kingSquare = this.findKing(turn);
            if (kingSquare) {
                const square = this.board.querySelector(`[data-square="${kingSquare}"]`);
                if (square) {
                    const indicator = document.createElement('div');
                    indicator.className = 'check-indicator';
                    square.appendChild(indicator);
                }
            }
        }
    }
    
    findKing(color) {
        const board = this.chess.board();
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece && piece.type === 'k' && piece.color === color) {
                    const file = String.fromCharCode(97 + col);
                    const rank = 8 - row;
                    return `${file}${rank}`;
                }
            }
        }
        return null;
    }
    
    tryMove(from, to) {
        try {
            const move = this.chess.move({ from, to, promotion: 'q' });
            return move;
        } catch (e) {
            return null;
        }
    }
    
    addMoveToHistory(move) {
        // Trim history if we're not at the end (for when making a move after going back)
        if (this.currentMoveIndex < this.moveHistory.length - 1) {
            this.moveHistory = this.moveHistory.slice(0, this.currentMoveIndex + 1);
        }
        
        // Add the new position after the move
        this.moveHistory.push({
            fen: this.chess.fen(),
            move: move,
            san: move.san
        });
        this.currentMoveIndex = this.moveHistory.length - 1;
    }
    
    updateMoveList() {
        const moveList = document.getElementById('move-list');
        if (!moveList) return; // Check if element exists
        
        const history = this.chess.history();
        
        let html = '<div class="moves-container">';
        for (let i = 0; i < history.length; i++) {
            if (i % 2 === 0) {
                // Adjust index comparison: chess.history() index i corresponds to moveHistory index i+1
                html += `<div class="move-entry ${i === this.currentMoveIndex - 1 ? 'active' : ''}" data-move-index="${i + 1}">`;
                html += `<span class="move-number">${Math.floor(i / 2) + 1}.</span>`;
                html += `<span>${history[i]}</span>`;
            } else {
                html += `<span style="margin-left: 10px">${history[i]}</span>`;
                html += '</div>';
            }
        }
        if (history.length % 2 !== 0) {
            html += '</div>';
        }
        html += '</div>';
        
        moveList.innerHTML = html;
        
        moveList.querySelectorAll('.move-entry').forEach(entry => {
            entry.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.moveIndex);
                this.goToMove(index);
            });
        });
    }
    
    updateAnalysisInfo() {
        // These elements don't exist in the new layout, so check first
        const positionDiv = document.getElementById('current-position');
        const evalDiv = document.getElementById('evaluation');
        
        if (positionDiv) {
            positionDiv.innerHTML = `<strong>FEN:</strong><br>${this.chess.fen()}`;
        }
        
        if (evalDiv) {
            let status = '';
            if (this.chess.isCheckmate()) {
                status = `Checkmate! ${this.chess.turn() === 'w' ? 'Black' : 'White'} wins.`;
            } else if (this.chess.isDraw()) {
                status = 'Draw!';
            } else if (this.chess.isCheck()) {
                status = `${this.chess.turn() === 'w' ? 'White' : 'Black'} is in check.`;
            } else {
                status = `${this.chess.turn() === 'w' ? 'White' : 'Black'} to move.`;
            }
            
            evalDiv.innerHTML = `<strong>Status:</strong> ${status}`;
        }
        
        // Trigger engine analysis if available
        this.analyzeCurrentPosition();
    }
    
    analyzeCurrentPosition() {
        // Analyze the current position with the engine
        if (this.mistakeAnalysis && this.mistakeAnalysis.stockfish) {
            const fen = this.chess.fen();
            this.mistakeAnalysis.analyzeWithEngine(fen);
        }
    }
    
    goToMove(index) {
        if (index >= 0 && index < this.moveHistory.length) {
            this.currentMoveIndex = index;
            
            // When going to starting position, ensure chess.js is properly reset
            if (index === 0) {
                this.chess.reset();
            } else {
                this.chess.load(this.moveHistory[index].fen);
            }
            
            this.updatePosition();
            this.updateMoveList();
            this.updateAnalysisInfo();
            // Clear any mistake analysis arrows when navigating moves
            if (this.mistakeAnalysis) {
                this.mistakeAnalysis.clearArrows();
            }
        }
    }
    
    setupEventListeners() {
        document.getElementById('flip-board').addEventListener('click', () => {
            this.orientation = this.orientation === 'white' ? 'black' : 'white';
            this.renderBoard();
            this.renderCoordinates();
            this.updatePosition();
        });
        
        document.getElementById('reset-board').addEventListener('click', () => {
            this.chess.reset();
            this.initializeMoveHistory(); // Use the initialization method
            this.clearSelection();
            this.updatePosition();
            this.updateMoveList();
            this.updateAnalysisInfo();
            // Clear any arrows
            if (this.mistakeAnalysis) {
                this.mistakeAnalysis.clearArrows();
            }
        });
        
        document.getElementById('prev-move').addEventListener('click', () => {
            if (this.currentMoveIndex > 0) {
                this.goToMove(this.currentMoveIndex - 1);
            }
        });
        
        document.getElementById('next-move').addEventListener('click', () => {
            if (this.currentMoveIndex < this.moveHistory.length - 1) {
                this.goToMove(this.currentMoveIndex + 1);
            }
        });
        
        document.getElementById('first-move').addEventListener('click', () => {
            if (this.moveHistory.length > 0) {
                this.goToMove(0); // Go to the starting position
            }
        });
        
        document.getElementById('last-move').addEventListener('click', () => {
            if (this.moveHistory.length > 0) {
                this.goToMove(this.moveHistory.length - 1);
            }
        });
        
        document.getElementById('load-fen').addEventListener('click', () => {
            const fenInput = document.getElementById('fen-input').value.trim();
            if (fenInput) {
                try {
                    this.chess.load(fenInput);
                    // Initialize history with the loaded position as starting point
                    this.moveHistory = [{
                        fen: fenInput,
                        move: null,
                        san: 'Custom position'
                    }];
                    this.currentMoveIndex = 0;
                    this.clearSelection();
                    this.updatePosition();
                    this.updateMoveList();
                    this.updateAnalysisInfo();
                    document.getElementById('fen-input').value = '';
                    // Clear arrows when loading new position
                    if (this.mistakeAnalysis) {
                        this.mistakeAnalysis.clearArrows();
                    }
                } catch (e) {
                    alert('Invalid FEN position');
                }
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                document.getElementById('prev-move').click();
            } else if (e.key === 'ArrowRight') {
                document.getElementById('next-move').click();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const chessBoard = new ChessBoard();
    // Initialize mistake analysis after board is ready
    setTimeout(() => {
        const mistakeAnalysis = new MistakeAnalysis(chessBoard);
        // Make mistakeAnalysis accessible to chessBoard
        chessBoard.mistakeAnalysis = mistakeAnalysis;
    }, 100);
});