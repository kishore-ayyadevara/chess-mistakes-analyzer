import { Chess } from 'chess.js';

export class MistakeAnalysis {
    constructor(chessBoard) {
        this.chessBoard = chessBoard;
        this.mistakes = [];
        this.currentMistakeIndex = 0;
        this.loadMistakes();
    }
    
    async loadMistakes() {
        try {
            const response = await fetch('chess_mistakes.json');
            this.mistakes = await response.json();
            console.log(`Loaded ${this.mistakes.length} chess mistakes`);
            this.setupUI();
            if (this.mistakes.length > 0) {
                this.loadMistake(0);
            }
        } catch (error) {
            console.error('Failed to load mistakes:', error);
        }
    }
    
    setupUI() {
        // Add mistake navigation
        const mistakeNav = document.createElement('div');
        mistakeNav.className = 'mistake-navigation';
        mistakeNav.innerHTML = `
            <h3>Mistake Analysis (${this.mistakes.length} positions)</h3>
            <div class="mistake-controls">
                <button id="prev-mistake">← Previous</button>
                <span id="mistake-counter">1 / ${this.mistakes.length}</span>
                <button id="next-mistake">Next →</button>
            </div>
            <div class="motif-filters" id="motif-filters"></div>
        `;
        
        // Add analysis panel
        const analysisPanel = document.createElement('div');
        analysisPanel.className = 'mistake-analysis-panel';
        analysisPanel.innerHTML = `
            <div class="mistake-info">
                <h4>Mistake Details</h4>
                <div id="mistake-move"></div>
                <div id="mistake-eval"></div>
                <div id="mistake-motifs"></div>
                <div id="mistake-reasoning"></div>
            </div>
            <div class="practice-controls">
                <button id="show-best-move">Show Best Move</button>
                <button id="practice-position">Practice This Position</button>
            </div>
        `;
        
        // Insert into the DOM
        const infoPanel = document.querySelector('.info-panel');
        infoPanel.appendChild(mistakeNav);
        infoPanel.appendChild(analysisPanel);
        
        // Setup event listeners
        document.getElementById('prev-mistake').addEventListener('click', () => {
            if (this.currentMistakeIndex > 0) {
                this.loadMistake(this.currentMistakeIndex - 1);
            }
        });
        
        document.getElementById('next-mistake').addEventListener('click', () => {
            if (this.currentMistakeIndex < this.mistakes.length - 1) {
                this.loadMistake(this.currentMistakeIndex + 1);
            }
        });
        
        document.getElementById('show-best-move').addEventListener('click', () => {
            this.showBestMove();
        });
        
        document.getElementById('practice-position').addEventListener('click', () => {
            this.startPractice();
        });
        
        // Create motif filters
        this.createMotifFilters();
    }
    
    createMotifFilters() {
        // Count motif frequencies
        const motifCounts = {};
        this.mistakes.forEach(mistake => {
            mistake.analysis.motifs.forEach(motif => {
                motifCounts[motif] = (motifCounts[motif] || 0) + 1;
            });
        });
        
        // Create filter buttons for top motifs
        const filtersDiv = document.getElementById('motif-filters');
        filtersDiv.innerHTML = '<h4>Filter by Motif:</h4>';
        
        // Add "All" button
        const allBtn = document.createElement('button');
        allBtn.className = 'motif-filter active';
        allBtn.textContent = `All (${this.mistakes.length})`;
        allBtn.addEventListener('click', () => this.filterByMotif(null));
        filtersDiv.appendChild(allBtn);
        
        // Add top motif buttons
        Object.entries(motifCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .forEach(([motif, count]) => {
                const btn = document.createElement('button');
                btn.className = 'motif-filter';
                btn.textContent = `${motif} (${count})`;
                btn.addEventListener('click', () => this.filterByMotif(motif));
                filtersDiv.appendChild(btn);
            });
    }
    
    filterByMotif(motif) {
        // Update active button
        document.querySelectorAll('.motif-filter').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        if (!motif) {
            // Show all mistakes
            this.filteredMistakes = null;
            this.currentMistakeIndex = 0;
        } else {
            // Filter by motif
            this.filteredMistakes = this.mistakes.filter(m => 
                m.analysis.motifs.includes(motif)
            );
            this.currentMistakeIndex = 0;
        }
        
        const mistakes = this.filteredMistakes || this.mistakes;
        document.getElementById('mistake-counter').textContent = 
            `${this.currentMistakeIndex + 1} / ${mistakes.length}`;
        
        if (mistakes.length > 0) {
            this.loadMistake(0, this.filteredMistakes);
        }
    }
    
    loadMistake(index, mistakeList = null) {
        const mistakes = mistakeList || this.mistakes;
        if (index < 0 || index >= mistakes.length) return;
        
        this.currentMistakeIndex = index;
        const mistake = mistakes[index];
        
        // Load position
        this.chessBoard.chess.load(mistake.position.fen);
        this.chessBoard.updatePosition();
        
        // Update counter
        document.getElementById('mistake-counter').textContent = 
            `${index + 1} / ${mistakes.length}`;
        
        // Update mistake info
        document.getElementById('mistake-move').innerHTML = `
            <strong>Move ${mistake.position.move_number}</strong><br>
            Played: <span class="mistake-move">${mistake.moves.actual}</span><br>
            Best: <span class="best-move">${mistake.moves.best}</span>
        `;
        
        document.getElementById('mistake-eval').innerHTML = `
            <strong>Evaluation Loss:</strong> ${mistake.evaluation.difference.toFixed(2)}<br>
            <div class="eval-bar">
                <div class="eval-loss" style="width: ${Math.min(mistake.evaluation.difference * 20, 100)}%"></div>
            </div>
            Quality: <span class="move-quality-${mistake.evaluation.quality}">${mistake.evaluation.quality}</span>
        `;
        
        document.getElementById('mistake-motifs').innerHTML = `
            <strong>Tactical Motifs:</strong><br>
            ${mistake.analysis.motifs.map(m => `<span class="motif-tag">${m}</span>`).join(' ')}
        `;
        
        document.getElementById('mistake-reasoning').innerHTML = `
            <strong>Analysis:</strong><br>
            <div class="reasoning-text">${mistake.analysis.reasoning}</div>
        `;
        
        // Draw arrows for the mistake and best move
        this.drawMoveArrows(mistake);
    }
    
    drawMoveArrows(mistake) {
        // Clear existing arrows
        this.clearArrows();
        
        // Parse moves to get from/to squares
        const actualMove = this.parseMove(mistake.moves.actual, mistake.position.fen);
        const bestMove = this.parseMove(mistake.moves.best, mistake.position.fen);
        
        if (actualMove) {
            this.drawArrow(actualMove.from, actualMove.to, 'red');
        }
        
        if (bestMove) {
            this.drawArrow(bestMove.from, bestMove.to, 'green');
        }
    }
    
    parseMove(moveStr, fen) {
        // Try to parse the move using chess.js
        const tempChess = new Chess(fen);
        try {
            const move = tempChess.move(moveStr);
            if (move) {
                return { from: move.from, to: move.to };
            }
        } catch (e) {
            // Move parsing failed
        }
        return null;
    }
    
    drawArrow(from, to, color) {
        // Create SVG arrow overlay
        const board = document.getElementById('chess-board');
        const svg = document.getElementById('arrow-svg') || this.createArrowSVG();
        
        const fromSquare = document.querySelector(`[data-square="${from}"]`);
        const toSquare = document.querySelector(`[data-square="${to}"]`);
        
        if (!fromSquare || !toSquare) return;
        
        const fromRect = fromSquare.getBoundingClientRect();
        const toRect = toSquare.getBoundingClientRect();
        const boardRect = board.getBoundingClientRect();
        
        const x1 = fromRect.left - boardRect.left + fromRect.width / 2;
        const y1 = fromRect.top - boardRect.top + fromRect.height / 2;
        const x2 = toRect.left - boardRect.left + toRect.width / 2;
        const y2 = toRect.top - boardRect.top + toRect.height / 2;
        
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        arrow.setAttribute('x1', x1);
        arrow.setAttribute('y1', y1);
        arrow.setAttribute('x2', x2);
        arrow.setAttribute('y2', y2);
        arrow.setAttribute('stroke', color);
        arrow.setAttribute('stroke-width', '5');
        arrow.setAttribute('marker-end', `url(#arrowhead-${color})`);
        arrow.setAttribute('opacity', '0.7');
        arrow.className = 'move-arrow';
        
        svg.appendChild(arrow);
    }
    
    createArrowSVG() {
        const board = document.getElementById('chess-board');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'arrow-svg';
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '20';
        
        // Define arrowheads
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        
        ['red', 'green', 'yellow'].forEach(color => {
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.setAttribute('id', `arrowhead-${color}`);
            marker.setAttribute('markerWidth', '10');
            marker.setAttribute('markerHeight', '10');
            marker.setAttribute('refX', '9');
            marker.setAttribute('refY', '3');
            marker.setAttribute('orient', 'auto');
            
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', '0 0, 10 3, 0 6');
            polygon.setAttribute('fill', color);
            
            marker.appendChild(polygon);
            defs.appendChild(marker);
        });
        
        svg.appendChild(defs);
        board.appendChild(svg);
        
        return svg;
    }
    
    clearArrows() {
        const svg = document.getElementById('arrow-svg');
        if (svg) {
            svg.querySelectorAll('.move-arrow').forEach(arrow => arrow.remove());
        }
    }
    
    showBestMove() {
        const mistake = (this.filteredMistakes || this.mistakes)[this.currentMistakeIndex];
        if (!mistake) return;
        
        // Highlight the best move
        const bestMove = this.parseMove(mistake.moves.best, mistake.position.fen);
        if (bestMove) {
            const fromSquare = document.querySelector(`[data-square="${bestMove.from}"]`);
            const toSquare = document.querySelector(`[data-square="${bestMove.to}"]`);
            
            if (fromSquare) fromSquare.classList.add('best-move-from');
            if (toSquare) toSquare.classList.add('best-move-to');
            
            setTimeout(() => {
                if (fromSquare) fromSquare.classList.remove('best-move-from');
                if (toSquare) toSquare.classList.remove('best-move-to');
            }, 2000);
        }
    }
    
    startPractice() {
        const mistake = (this.filteredMistakes || this.mistakes)[this.currentMistakeIndex];
        if (!mistake) return;
        
        // Hide arrows
        this.clearArrows();
        
        // Enable practice mode
        alert(`Find the best move! (Hint: Look for ${mistake.analysis.motifs[0]})`);
        
        // TODO: Implement interactive practice mode
    }
}