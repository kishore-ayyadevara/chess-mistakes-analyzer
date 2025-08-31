import { Chess } from 'chess.js';
import { getStockfishService } from './stockfishService.js';

export class MistakeAnalysis {
    constructor(chessBoard) {
        this.chessBoard = chessBoard;
        this.mistakes = [];
        this.currentMistakeIndex = 0;
        this.filteredMistakes = null;
        this.stockfish = null;
        this.activeMotifFilter = '';
        this.activePhaseFilter = '';
        this.showLoadingState();
        this.initStockfish();
        this.loadMistakes();
    }
    
    async initStockfish() {
        try {
            this.stockfish = getStockfishService();
            // Wait a bit for engine to initialize
            setTimeout(() => {
                const statusEl = document.getElementById('engine-status');
                if (statusEl) {
                    statusEl.textContent = 'Ready';
                    statusEl.classList.add('ready');
                }
            }, 2000);
        } catch (error) {
            console.error('Failed to initialize Stockfish:', error);
            const statusEl = document.getElementById('engine-status');
            if (statusEl) {
                statusEl.textContent = 'Engine unavailable';
            }
        }
    }
    
    showLoadingState() {
        const statsEl = document.getElementById('quick-stats');
        if (statsEl) {
            statsEl.textContent = 'Loading positions...';
        }
        const counterEl = document.getElementById('mistake-counter');
        if (counterEl) {
            counterEl.textContent = 'Loading...';
        }
    }
    
    async loadMistakes() {
        try {
            console.log('Loading chess mistakes...');
            const response = await fetch('/public/chess_mistakes.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.mistakes = await response.json();
            console.log(`Successfully loaded ${this.mistakes.length} chess mistakes`);
            this.setupUI();
            this.setupEventListeners();
            if (this.mistakes.length > 0) {
                this.loadMistake(0);
            }
        } catch (error) {
            console.error('Failed to load mistakes:', error);
            // Show error in UI
            const statsEl = document.getElementById('quick-stats');
            if (statsEl) {
                statsEl.textContent = 'Error loading positions. Check console.';
                statsEl.style.color = '#ff6b6b';
            }
        }
    }
    
    setupUI() {
        // Update header stats
        const statsEl = document.getElementById('quick-stats');
        if (statsEl) {
            const stats = this.calculateStats();
            statsEl.textContent = `${this.mistakes.length} positions | ${stats.opening} opening | ${stats.middlegame} middlegame | ${stats.endgame} endgame`;
        }
        
        // Create both filter types
        this.createGamePhaseFilters();
        this.createMotifFilters();
    }
    
    calculateStats() {
        const stats = { opening: 0, middlegame: 0, endgame: 0 };
        this.mistakes.forEach(m => {
            const phase = m.position.game_state.replace(' ', '');
            if (stats[phase] !== undefined) stats[phase]++;
        });
        return stats;
    }
    
    createGamePhaseFilters() {
        const filtersDiv = document.getElementById('phase-filters');
        if (!filtersDiv) {
            console.warn('Phase filters div not found');
            return;
        }
        
        // Clear existing filters
        filtersDiv.innerHTML = '';
        
        const stats = this.calculateStats();
        
        // Add phase filter buttons
        const phases = [
            { name: 'All Phases', count: this.mistakes.length, value: '', icon: '' },
            { name: 'Opening', count: stats.opening, value: 'opening', icon: '' },
            { name: 'Middlegame', count: stats.middlegame, value: 'middlegame', icon: '' },
            { name: 'Endgame', count: stats.endgame, value: 'endgame', icon: '' }
        ];
        
        phases.forEach(phase => {
            const btn = document.createElement('button');
            btn.className = 'phase-filter';
            if (phase.value === '') btn.classList.add('active');
            btn.textContent = `${phase.name} (${phase.count})`;
            btn.dataset.phase = phase.value;
            filtersDiv.appendChild(btn);
        });
        
        console.log('Created game phase filters');
    }
    
    createMotifFilters() {
        // Count motif frequencies
        const motifCounts = {};
        this.mistakes.forEach(mistake => {
            if (mistake.analysis && mistake.analysis.motifs) {
                mistake.analysis.motifs.forEach(motif => {
                    motifCounts[motif] = (motifCounts[motif] || 0) + 1;
                });
            }
        });
        
        // Create filter buttons
        const filtersDiv = document.getElementById('motif-filters');
        if (!filtersDiv) {
            console.warn('Motif filters div not found');
            return;
        }
        
        // Clear existing filters
        filtersDiv.innerHTML = '';
        
        // Add "All" button
        const allBtn = document.createElement('button');
        allBtn.className = 'motif-filter active';
        allBtn.textContent = `All Patterns (${this.mistakes.length})`;
        allBtn.dataset.motif = '';
        filtersDiv.appendChild(allBtn);
        
        // Add top motif buttons
        Object.entries(motifCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([motif, count]) => {
                const btn = document.createElement('button');
                btn.className = 'motif-filter';
                btn.textContent = `${motif} (${count})`;
                btn.dataset.motif = motif;
                filtersDiv.appendChild(btn);
            });
        
        console.log('Created', Object.keys(motifCounts).length, 'motif filters');
    }
    
    setupEventListeners() {
        // Navigation buttons
        document.getElementById('prev-mistake')?.addEventListener('click', () => {
            const mistakes = this.filteredMistakes || this.mistakes;
            if (this.currentMistakeIndex > 0) {
                this.loadMistake(this.currentMistakeIndex - 1, this.filteredMistakes);
            }
        });
        
        document.getElementById('next-mistake')?.addEventListener('click', () => {
            const mistakes = this.filteredMistakes || this.mistakes;
            if (this.currentMistakeIndex < mistakes.length - 1) {
                this.loadMistake(this.currentMistakeIndex + 1, this.filteredMistakes);
            }
        });
        
        // Action buttons
        document.getElementById('show-best-move')?.addEventListener('click', () => {
            this.showBestMove();
        });
        
        document.getElementById('practice-position')?.addEventListener('click', () => {
            this.startPractice();
        });
        
        document.getElementById('load-fen-btn')?.addEventListener('click', () => {
            document.getElementById('fen-modal')?.classList.remove('hidden');
        });
        
        // Modal controls
        document.querySelector('.close-modal')?.addEventListener('click', () => {
            document.getElementById('fen-modal')?.classList.add('hidden');
        });
        
        document.getElementById('load-fen')?.addEventListener('click', () => {
            const fenInput = document.getElementById('fen-input');
            if (fenInput?.value) {
                this.chessBoard.chess.load(fenInput.value);
                this.chessBoard.updatePosition();
                document.getElementById('fen-modal')?.classList.add('hidden');
                fenInput.value = '';
            }
        });
        
        // Motif filter buttons
        document.getElementById('motif-filters')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('motif-filter')) {
                this.activeMotifFilter = e.target.dataset.motif || '';
                this.applyFilters();
                
                // Update active state
                document.querySelectorAll('.motif-filter').forEach(btn => {
                    btn.classList.remove('active');
                });
                e.target.classList.add('active');
            }
        });
        
        // Phase filter buttons
        document.getElementById('phase-filters')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('phase-filter')) {
                this.activePhaseFilter = e.target.dataset.phase || '';
                this.applyFilters();
                
                // Update active state
                document.querySelectorAll('.phase-filter').forEach(btn => {
                    btn.classList.remove('active');
                });
                e.target.classList.add('active');
            }
        });
        
        // Deep analysis button
        document.getElementById('analyze-deeper')?.addEventListener('click', () => {
            this.performDeepAnalysis();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' && e.shiftKey) {
                document.getElementById('prev-mistake')?.click();
            } else if (e.key === 'ArrowRight' && e.shiftKey) {
                document.getElementById('next-mistake')?.click();
            } else if (e.key === ' ' && e.shiftKey) {
                e.preventDefault();
                this.showBestMove();
            }
        });
    }
    
    async performDeepAnalysis() {
        const mistakes = this.filteredMistakes || this.mistakes;
        const mistake = mistakes[this.currentMistakeIndex];
        if (!mistake) return;
        
        // First run normal analysis if not done yet
        const evalEl = document.getElementById('engine-evaluation');
        if (evalEl && evalEl.textContent === '0.00') {
            await this.analyzeWithEngine(mistake.position.fen);
            return;
        }
        
        // Then do deep analysis
        if (!this.stockfish) return;
        
        const statusEl = document.getElementById('engine-status');
        const analyzeBtn = document.getElementById('analyze-deeper');
        const altEl = document.getElementById('engine-alternatives');
        
        if (statusEl) {
            statusEl.textContent = 'Deep analysis...';
            statusEl.classList.add('analyzing');
        }
        
        if (analyzeBtn) {
            analyzeBtn.disabled = true;
            analyzeBtn.textContent = '⏳ Analyzing...';
        }
        
        if (altEl) {
            altEl.innerHTML = '<div class="alternative-move"><span>Calculating variations...</span></div>';
        }
        
        try {
            // Perform deeper analysis
            const analysis = await this.stockfish.analyzePosition(mistake.position.fen, { 
                depth: 20, 
                time: 5000 
            });
            
            // Update UI with results
            if (analysis) {
                const depthEl = document.getElementById('engine-depth');
                const evalEl = document.getElementById('engine-evaluation');
                const pvEl = document.getElementById('engine-pv');
                
                if (depthEl) {
                    depthEl.textContent = `Depth: ${analysis.depth}`;
                }
                
                if (evalEl && analysis.score !== null) {
                    const formatted = this.stockfish.formatEvaluation(analysis.score);
                    evalEl.textContent = formatted;
                    evalEl.classList.remove('advantage-white', 'advantage-black');
                    if (analysis.score > 0.3) {
                        evalEl.classList.add('advantage-white');
                    } else if (analysis.score < -0.3) {
                        evalEl.classList.add('advantage-black');
                    }
                }
                
                if (pvEl && analysis.pv) {
                    const moves = analysis.pv.slice(0, 8).join(' ');
                    pvEl.textContent = moves ? `Best line: ${moves}` : '';
                }
                
                // Update alternative moves with better handling
                if (altEl && analysis.multipv && analysis.multipv.length > 0) {
                    let html = '';
                    let foundValidMoves = false;
                    
                    for (let i = 0; i < Math.min(3, analysis.multipv.length); i++) {
                        const line = analysis.multipv[i];
                        if (line && line.pv && line.pv.length > 0) {
                            const move = line.pv[0];
                            const score = line.score !== null && line.score !== undefined 
                                ? this.stockfish.formatEvaluation(line.score) 
                                : '?';
                            
                            // Convert UCI move to SAN if possible
                            const displayMove = this.convertUCItoSAN(move, mistake.position.fen) || move;
                            
                            html += `<div class="alternative-move">
                                <span>${i + 1}. ${displayMove}</span>
                                <span>${score}</span>
                            </div>`;
                            foundValidMoves = true;
                        }
                    }
                    
                    if (foundValidMoves) {
                        altEl.innerHTML = html;
                    } else {
                        altEl.innerHTML = '<div class="alternative-move"><span>No variations found</span></div>';
                    }
                }
            }
        } catch (error) {
            console.error('Deep analysis failed:', error);
            if (altEl) {
                altEl.innerHTML = '<div class="alternative-move"><span>Analysis error</span></div>';
            }
        } finally {
            if (statusEl) {
                statusEl.textContent = 'Ready';
                statusEl.classList.remove('analyzing');
                statusEl.classList.add('ready');
            }
            
            if (analyzeBtn) {
                analyzeBtn.disabled = false;
                analyzeBtn.innerHTML = '<span>🔍</span> Deep Analysis';
            }
        }
    }
    
    applyFilters() {
        console.log('Applying filters - Phase:', this.activePhaseFilter || 'All', 'Motif:', this.activeMotifFilter || 'All');
        
        let filtered = this.mistakes;
        
        // Apply phase filter
        if (this.activePhaseFilter) {
            filtered = filtered.filter(m => {
                const phase = m.position.game_state.replace(' ', '').toLowerCase();
                return phase === this.activePhaseFilter;
            });
        }
        
        // Apply motif filter
        if (this.activeMotifFilter) {
            filtered = filtered.filter(m => 
                m.analysis && m.analysis.motifs && m.analysis.motifs.includes(this.activeMotifFilter)
            );
        }
        
        // Update filtered mistakes
        this.filteredMistakes = (this.activePhaseFilter || this.activeMotifFilter) ? filtered : null;
        
        console.log(`Found ${filtered.length} positions after filtering`);
        
        this.currentMistakeIndex = 0;
        const mistakes = this.filteredMistakes || this.mistakes;
        
        if (mistakes.length > 0) {
            this.loadMistake(0, this.filteredMistakes);
        } else {
            // Show no results message
            const counterEl = document.getElementById('mistake-counter');
            if (counterEl) {
                counterEl.textContent = '0/0';
            }
            let filterDesc = [];
            if (this.activePhaseFilter) filterDesc.push(`phase: ${this.activePhaseFilter}`);
            if (this.activeMotifFilter) filterDesc.push(`motif: ${this.activeMotifFilter}`);
            alert(`No positions found with ${filterDesc.join(' and ')}`);
        }
    }
    
    filterByMotif(motif) {
        // Kept for backward compatibility if needed
        this.activeMotifFilter = motif || '';
        this.applyFilters();
    }
    
    loadMistake(index, mistakeList = null) {
        const mistakes = mistakeList || this.mistakes;
        if (index < 0 || index >= mistakes.length) return;
        
        this.currentMistakeIndex = index;
        const mistake = mistakes[index];
        
        // Load position
        this.chessBoard.chess.load(mistake.position.fen);
        this.chessBoard.updatePosition();
        
        // Update navigation
        document.getElementById('mistake-counter').textContent = 
            `${index + 1}/${mistakes.length}`;
        
        // Update progress bar
        const progress = ((index + 1) / mistakes.length) * 100;
        const progressFill = document.getElementById('progress-fill');
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        
        // Update move info (hide best move initially)
        const actualMoveEl = document.getElementById('actual-move');
        const bestMoveEl = document.getElementById('best-move');
        const actualEvalEl = document.getElementById('actual-eval');
        const bestEvalEl = document.getElementById('best-eval');
        
        if (actualMoveEl) actualMoveEl.textContent = mistake.moves.actual || '--';
        if (bestMoveEl) {
            bestMoveEl.textContent = '??';
            bestMoveEl.dataset.bestMove = mistake.moves.best || '--'; // Store for later reveal
        }
        
        // Update evaluations
        if (actualEvalEl) {
            const evalValue = mistake.evaluation.after_actual;
            actualEvalEl.textContent = this.formatEvaluation(evalValue);
            actualEvalEl.className = 'move-eval';
            if (Math.abs(evalValue) > 1) {
                actualEvalEl.classList.add(evalValue > 0 ? 'eval-good' : 'eval-bad');
            }
        }
        
        if (bestEvalEl) {
            const evalValue = mistake.evaluation.after_best;
            bestEvalEl.textContent = this.formatEvaluation(evalValue);
            bestEvalEl.dataset.bestEval = evalValue; // Store for later reveal
            bestEvalEl.classList.add('hidden');
        }
        
        // Update tactical motifs
        const motifsDiv = document.getElementById('mistake-motifs');
        if (motifsDiv) {
            motifsDiv.innerHTML = mistake.analysis.motifs
                .map(m => `<span class="motif-tag">${m}</span>`)
                .join('');
        }
        
        // Hide reasoning initially
        const reasoningDiv = document.getElementById('mistake-reasoning');
        if (reasoningDiv) {
            reasoningDiv.textContent = 'Click "Show Best" to reveal analysis';
            reasoningDiv.style.fontStyle = 'italic';
            reasoningDiv.style.color = '#888';
        }
        
        // Don't draw arrows automatically - wait for user to request
        this.clearArrows();
        
        // Clear engine analysis display
        const evalEl = document.getElementById('engine-evaluation');
        const depthEl = document.getElementById('engine-depth');
        const pvEl = document.getElementById('engine-pv');
        const altEl = document.getElementById('engine-alternatives');
        
        if (evalEl) evalEl.textContent = '0.00';
        if (depthEl) depthEl.textContent = '';
        if (pvEl) pvEl.textContent = '';
        if (altEl) altEl.innerHTML = '';
        
        // Don't analyze automatically - wait for user to request
        // this.analyzeWithEngine(mistake.position.fen);
    }
    
    async analyzeWithEngine(fen) {
        if (!this.stockfish) return;
        
        // Update status
        const statusEl = document.getElementById('engine-status');
        const depthEl = document.getElementById('engine-depth');
        const evalEl = document.getElementById('engine-evaluation');
        const pvEl = document.getElementById('engine-pv');
        const altEl = document.getElementById('engine-alternatives');
        
        if (statusEl) {
            statusEl.textContent = 'Analyzing...';
            statusEl.classList.remove('ready');
            statusEl.classList.add('analyzing');
        }
        
        try {
            // Get engine analysis
            const analysis = await this.stockfish.analyzePosition(fen, { 
                depth: 8, 
                time: 500 
            });
            
            if (analysis) {
                // Update depth
                if (depthEl) {
                    depthEl.textContent = `Depth: ${analysis.depth}`;
                }
                
                // Update evaluation
                if (evalEl && analysis.score !== null) {
                    const formatted = this.stockfish.formatEvaluation(analysis.score);
                    evalEl.textContent = formatted;
                    
                    // Color based on who's better
                    evalEl.classList.remove('advantage-white', 'advantage-black');
                    if (analysis.score > 0.3) {
                        evalEl.classList.add('advantage-white');
                    } else if (analysis.score < -0.3) {
                        evalEl.classList.add('advantage-black');
                    }
                }
                
                // Update principal variation
                if (pvEl && analysis.pv) {
                    const moves = analysis.pv.slice(0, 5).join(' ');
                    pvEl.textContent = moves ? `Best line: ${moves}` : '';
                }
                
                // Update alternative moves
                if (altEl && analysis.multipv && analysis.multipv.length > 0) {
                    let html = '';
                    let foundValidMoves = false;
                    
                    for (let i = 0; i < Math.min(3, analysis.multipv.length); i++) {
                        const line = analysis.multipv[i];
                        if (line && line.pv && line.pv.length > 0) {
                            const move = line.pv[0];
                            const score = line.score !== null && line.score !== undefined 
                                ? this.stockfish.formatEvaluation(line.score) 
                                : '?';
                            
                            // Convert UCI move to SAN if possible
                            const displayMove = this.convertUCItoSAN(move, fen) || move;
                            
                            html += `<div class="alternative-move">
                                <span>${i + 1}. ${displayMove}</span>
                                <span>${score}</span>
                            </div>`;
                            foundValidMoves = true;
                        }
                    }
                    
                    if (foundValidMoves) {
                        altEl.innerHTML = html;
                    } else {
                        altEl.innerHTML = '<div class="alternative-move"><span>Analyzing variations...</span></div>';
                    }
                }
            }
            
            // Update status
            if (statusEl) {
                statusEl.textContent = 'Ready';
                statusEl.classList.remove('analyzing');
                statusEl.classList.add('ready');
            }
        } catch (error) {
            console.error('Engine analysis failed:', error);
            if (statusEl) {
                statusEl.textContent = 'Analysis failed';
                statusEl.classList.remove('analyzing');
            }
        }
    }
    
    drawMoveArrows(mistake) {
        this.clearArrows();
        
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
        arrow.setAttribute('stroke-width', '6');
        arrow.setAttribute('marker-end', `url(#arrowhead-${color})`);
        arrow.setAttribute('opacity', '0.6');
        arrow.setAttribute('class', 'move-arrow');
        
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
        
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        
        ['red', 'green'].forEach(color => {
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
        const mistakes = this.filteredMistakes || this.mistakes;
        const mistake = mistakes[this.currentMistakeIndex];
        if (!mistake) return;
        
        // Progressive reveal:
        // Step 1: Reveal the best move, its evaluation, AND the reasoning/insight together
        const bestMoveEl = document.getElementById('best-move');
        const bestEvalEl = document.getElementById('best-eval');
        const reasoningDiv = document.getElementById('mistake-reasoning');
        
        if (bestMoveEl && bestMoveEl.dataset.bestMove && bestMoveEl.textContent === '??') {
            // First click: reveal move notation, evaluation AND reasoning
            bestMoveEl.textContent = bestMoveEl.dataset.bestMove;
            
            // Reveal the best move's evaluation
            if (bestEvalEl) {
                bestEvalEl.classList.remove('hidden');
                const evalValue = parseFloat(bestEvalEl.dataset.bestEval || 0);
                bestEvalEl.className = 'move-eval';
                if (Math.abs(evalValue) > 1) {
                    bestEvalEl.classList.add(evalValue > 0 ? 'eval-good' : 'eval-bad');
                }
            }
            
            // Also reveal the reasoning at the same time
            if (reasoningDiv) {
                const reasoning = mistake.analysis.reasoning || 'No analysis available';
                reasoningDiv.textContent = reasoning;
                reasoningDiv.style.fontStyle = 'normal';
                reasoningDiv.style.color = '#b0b0b0';
            }
            return;
        }
        
        // Step 2: Draw arrows and highlight squares (on second click)
        this.clearArrows();
        this.drawMoveArrows(mistake);
        
        // Also highlight the best move squares briefly
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
    
    formatEvaluation(value) {
        // Format evaluation for display
        if (value === null || value === undefined) return '--';
        const formatted = value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
        return formatted;
    }
    
    convertUCItoSAN(uciMove, fen) {
        // Convert UCI notation (e.g., 'e2e4') to SAN (e.g., 'e4')
        if (!uciMove || uciMove.length < 4) return null;
        
        try {
            const tempChess = new Chess(fen);
            const from = uciMove.substring(0, 2);
            const to = uciMove.substring(2, 4);
            const promotion = uciMove.length > 4 ? uciMove.charAt(4) : undefined;
            
            const move = tempChess.move({ from, to, promotion });
            return move ? move.san : uciMove;
        } catch (e) {
            return uciMove; // Return original if conversion fails
        }
    }
    
    startPractice() {
        const mistakes = this.filteredMistakes || this.mistakes;
        const mistake = mistakes[this.currentMistakeIndex];
        if (!mistake) return;
        
        this.clearArrows();
        
        const motif = mistake.analysis.motifs[0] || 'tactical pattern';
        alert(`Find the best move!\nHint: Look for ${motif}`);
    }
}