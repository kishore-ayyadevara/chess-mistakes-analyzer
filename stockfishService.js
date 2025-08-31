export class StockfishService {
    constructor() {
        this.engine = null;
        this.isReady = false;
        this.currentAnalysis = null;
        this.initEngine();
    }
    
    async initEngine() {
        try {
            // Create Stockfish worker from local file
            this.engine = new Worker('/public/stockfish.js');
            
            // Handle messages from engine
            this.engine.addEventListener('message', (event) => {
                const message = event.data;
                console.log('Engine:', message);
                
                if (message === 'uciok') {
                    // Configure MultiPV after UCI is ready
                    console.log('UCI ready, configuring MultiPV...');
                    this.sendCommand('setoption name MultiPV value 3');
                    this.sendCommand('isready');
                }
                
                if (message === 'readyok') {
                    this.isReady = true;
                    console.log('Stockfish fully ready!');
                }
                
                // Parse info messages
                if (typeof message === 'string') {
                    if (message.startsWith('info')) {
                        this.parseInfoMessage(message);
                    } else if (message.startsWith('bestmove')) {
                        this.parseBestMove(message);
                    }
                }
            });
            
            // Initialize UCI
            this.sendCommand('uci');
            
            console.log('Stockfish engine initializing...');
        } catch (error) {
            console.error('Failed to initialize Stockfish:', error);
            this.isReady = false;
        }
    }
    
    parseInfoMessage(message) {
        if (!this.currentAnalysis) {
            this.currentAnalysis = {
                depth: 0,
                score: null,
                pv: [],
                multipv: []
            };
        }
        
        // Parse MultiPV first to know which line we're processing
        const multipvMatch = message.match(/multipv (\d+)/);
        const pvIndex = multipvMatch ? parseInt(multipvMatch[1]) - 1 : -1;
        
        // Debug log for multipv messages
        if (pvIndex >= 0) {
            console.log(`MultiPV line ${pvIndex + 1}:`, message);
        }
        
        // Parse depth
        const depthMatch = message.match(/depth (\d+)/);
        if (depthMatch) {
            const depth = parseInt(depthMatch[1]);
            if (pvIndex >= 0) {
                // Store depth for specific multipv line
                if (!this.currentAnalysis.multipv[pvIndex]) {
                    this.currentAnalysis.multipv[pvIndex] = {};
                }
                this.currentAnalysis.multipv[pvIndex].depth = depth;
            } else {
                this.currentAnalysis.depth = depth;
            }
        }
        
        // Parse score
        const scoreMatch = message.match(/score (cp|mate) (-?\d+)/);
        if (scoreMatch) {
            let score;
            if (scoreMatch[1] === 'cp') {
                // Centipawns to pawns
                score = parseInt(scoreMatch[2]) / 100;
            } else {
                // Mate in N moves
                const mateIn = parseInt(scoreMatch[2]);
                score = mateIn > 0 ? 1000 - mateIn : -1000 - mateIn;
            }
            
            if (pvIndex >= 0) {
                // Store score for specific multipv line
                if (!this.currentAnalysis.multipv[pvIndex]) {
                    this.currentAnalysis.multipv[pvIndex] = {};
                }
                this.currentAnalysis.multipv[pvIndex].score = score;
            } else {
                this.currentAnalysis.score = score;
            }
        }
        
        // Parse principal variation - this is the key part for moves
        // The pv keyword is followed by space-separated moves
        const pvIndex2 = message.indexOf(' pv ');
        if (pvIndex2 !== -1) {
            // Extract everything after " pv "
            const pvString = message.substring(pvIndex2 + 4).trim();
            // Split by spaces and filter to only valid UCI moves
            const pv = pvString.split(/\s+/).filter(m => {
                // Valid UCI moves are 4-5 characters: source square + dest square + optional promotion
                return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m);
            });
            
            if (pv.length > 0) {
                if (pvIndex >= 0) {
                    // Store pv for specific multipv line
                    if (!this.currentAnalysis.multipv[pvIndex]) {
                        this.currentAnalysis.multipv[pvIndex] = {};
                    }
                    this.currentAnalysis.multipv[pvIndex].pv = pv;
                    console.log(`Stored PV for line ${pvIndex + 1}:`, pv);
                } else {
                    this.currentAnalysis.pv = pv;
                }
            }
        }
    }
    
    parseBestMove(message) {
        const match = message.match(/bestmove (\S+)(?: ponder (\S+))?/);
        if (match && this.currentAnalysis) {
            this.currentAnalysis.bestMove = match[1];
            this.currentAnalysis.ponderMove = match[2];
        }
    }
    
    sendCommand(command) {
        if (this.engine) {
            console.log('Send:', command);
            this.engine.postMessage(command);
        }
    }
    
    async analyzePosition(fen, options = {}) {
        if (!this.isReady) {
            console.warn('Engine not ready yet');
            return null;
        }
        
        const depth = options.depth || 10;
        const time = options.time || 1000;
        
        // Reset analysis
        this.currentAnalysis = null;
        
        // Set position and analyze
        this.sendCommand('stop');
        this.sendCommand('ucinewgame');
        // Re-configure MultiPV before each analysis to ensure it's set
        this.sendCommand('setoption name MultiPV value 3');
        this.sendCommand(`position fen ${fen}`);
        this.sendCommand(`go depth ${depth} movetime ${time}`);
        
        // Wait for analysis to complete
        return new Promise((resolve) => {
            setTimeout(() => {
                // Log the final analysis for debugging
                if (this.currentAnalysis) {
                    console.log('Analysis complete:', {
                        depth: this.currentAnalysis.depth,
                        score: this.currentAnalysis.score,
                        pv: this.currentAnalysis.pv,
                        multipv: this.currentAnalysis.multipv.map((line, i) => ({
                            index: i,
                            ...line
                        }))
                    });
                }
                resolve(this.currentAnalysis);
            }, time + 500);
        });
    }
    
    formatEvaluation(score) {
        if (score === null || score === undefined) return '0.00';
        
        if (Math.abs(score) > 900) {
            // Mate score
            const mateIn = 1000 - Math.abs(score);
            return score > 0 ? `M${mateIn}` : `-M${mateIn}`;
        }
        
        // Regular score
        const formatted = score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
        return formatted;
    }
    
    destroy() {
        if (this.engine) {
            this.sendCommand('quit');
            this.engine.terminate();
            this.engine = null;
        }
    }
}

// Singleton instance
let stockfishInstance = null;

export function getStockfishService() {
    if (!stockfishInstance) {
        stockfishInstance = new StockfishService();
    }
    return stockfishInstance;
}