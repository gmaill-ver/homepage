// ==========================================
// オセロゲーム
// ==========================================

const gameState = {
    canvas: null,
    ctx: null,
    board: [], // 8x8の盤面 (0:空, 1:黒, 2:白)
    currentPlayer: 1, // 1:黒, 2:白
    cellSize: 0,
    boardSize: 8
};

const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

// ゲーム初期化
function initOthelloGame() {
    gameState.canvas = document.getElementById('gameCanvas');
    if (!gameState.canvas) return;

    gameState.ctx = gameState.canvas.getContext('2d');

    // キャンバスサイズを設定（正方形）
    const containerWidth = gameState.canvas.offsetWidth;
    gameState.canvas.width = containerWidth;
    gameState.canvas.height = containerWidth;
    gameState.cellSize = containerWidth / 8;

    // 盤面初期化
    gameState.board = Array(8).fill(null).map(() => Array(8).fill(EMPTY));

    // 初期配置
    gameState.board[3][3] = WHITE;
    gameState.board[3][4] = BLACK;
    gameState.board[4][3] = BLACK;
    gameState.board[4][4] = WHITE;

    gameState.currentPlayer = BLACK;

    drawBoard();
    updateScore();
    updateStatus();
}

// 盤面を描画
function drawBoard() {
    const ctx = gameState.ctx;
    const size = gameState.cellSize;

    // 背景
    ctx.fillStyle = '#10B981';
    ctx.fillRect(0, 0, gameState.canvas.width, gameState.canvas.height);

    // グリッド線
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;

    for (let i = 0; i <= 8; i++) {
        // 縦線
        ctx.beginPath();
        ctx.moveTo(i * size, 0);
        ctx.lineTo(i * size, 8 * size);
        ctx.stroke();

        // 横線
        ctx.beginPath();
        ctx.moveTo(0, i * size);
        ctx.lineTo(8 * size, i * size);
        ctx.stroke();
    }

    // 石を描画
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (gameState.board[row][col] !== EMPTY) {
                drawStone(row, col, gameState.board[row][col]);
            }
        }
    }

    // 置ける場所をハイライト
    const validMoves = getValidMoves(gameState.currentPlayer);
    validMoves.forEach(([row, col]) => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(
            col * size + size / 2,
            row * size + size / 2,
            size / 6,
            0,
            Math.PI * 2
        );
        ctx.fill();
    });
}

// 石を描画
function drawStone(row, col, player) {
    const ctx = gameState.ctx;
    const size = gameState.cellSize;
    const x = col * size + size / 2;
    const y = row * size + size / 2;
    const radius = size * 0.4;

    ctx.fillStyle = player === BLACK ? '#1F2937' : '#F3F4F6';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // 縁取り
    ctx.strokeStyle = player === BLACK ? '#000' : '#D1D5DB';
    ctx.lineWidth = 2;
    ctx.stroke();
}

// 有効な手を取得
function getValidMoves(player) {
    const validMoves = [];

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (gameState.board[row][col] === EMPTY) {
                if (canPlace(row, col, player)) {
                    validMoves.push([row, col]);
                }
            }
        }
    }

    return validMoves;
}

// 指定位置に石を置けるか判定
function canPlace(row, col, player) {
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];

    for (const [dr, dc] of directions) {
        if (checkDirection(row, col, dr, dc, player)) {
            return true;
        }
    }

    return false;
}

// 特定方向に相手の石を挟めるか確認
function checkDirection(row, col, dr, dc, player) {
    const opponent = player === BLACK ? WHITE : BLACK;
    let r = row + dr;
    let c = col + dc;
    let foundOpponent = false;

    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        if (gameState.board[r][c] === EMPTY) {
            return false;
        }
        if (gameState.board[r][c] === opponent) {
            foundOpponent = true;
        } else if (gameState.board[r][c] === player) {
            return foundOpponent;
        }
        r += dr;
        c += dc;
    }

    return false;
}

// 石を置く
function placeStone(row, col) {
    if (gameState.board[row][col] !== EMPTY || !canPlace(row, col, gameState.currentPlayer)) {
        return false;
    }

    gameState.board[row][col] = gameState.currentPlayer;
    flipStones(row, col, gameState.currentPlayer);

    // 次のプレイヤーに交代
    gameState.currentPlayer = gameState.currentPlayer === BLACK ? WHITE : BLACK;

    // 次のプレイヤーが置ける場所がなければパス
    if (getValidMoves(gameState.currentPlayer).length === 0) {
        gameState.currentPlayer = gameState.currentPlayer === BLACK ? WHITE : BLACK;

        // 両者とも置けない場合はゲーム終了
        if (getValidMoves(gameState.currentPlayer).length === 0) {
            endGame();
            return true;
        }

        alert(`${gameState.currentPlayer === BLACK ? '⚪ 白' : '⚫ 黒'}は置く場所がありません。パスします。`);
    }

    drawBoard();
    updateScore();
    updateStatus();

    return true;
}

// 石をひっくり返す
function flipStones(row, col, player) {
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];

    for (const [dr, dc] of directions) {
        if (checkDirection(row, col, dr, dc, player)) {
            flipInDirection(row, col, dr, dc, player);
        }
    }
}

// 特定方向の石をひっくり返す
function flipInDirection(row, col, dr, dc, player) {
    const opponent = player === BLACK ? WHITE : BLACK;
    let r = row + dr;
    let c = col + dc;

    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        if (gameState.board[r][c] === opponent) {
            gameState.board[r][c] = player;
        } else {
            break;
        }
        r += dr;
        c += dc;
    }
}

// スコア更新
function updateScore() {
    let blackCount = 0;
    let whiteCount = 0;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (gameState.board[row][col] === BLACK) blackCount++;
            if (gameState.board[row][col] === WHITE) whiteCount++;
        }
    }

    document.getElementById('blackScore').textContent = blackCount;
    document.getElementById('whiteScore').textContent = whiteCount;
}

// ステータス更新
function updateStatus() {
    const statusEl = document.getElementById('gameStatus');
    statusEl.textContent = gameState.currentPlayer === BLACK ? '⚫ 黒の番です' : '⚪ 白の番です';
    statusEl.style.color = gameState.currentPlayer === BLACK ? '#1F2937' : '#6B7280';
}

// ゲーム終了
function endGame() {
    const blackCount = parseInt(document.getElementById('blackScore').textContent);
    const whiteCount = parseInt(document.getElementById('whiteScore').textContent);

    let resultText = '';
    if (blackCount > whiteCount) {
        resultText = `⚫ 黒の勝ち！<br><br>⚫ ${blackCount} - ${whiteCount} ⚪`;
    } else if (whiteCount > blackCount) {
        resultText = `⚪ 白の勝ち！<br><br>⚫ ${blackCount} - ${whiteCount} ⚪`;
    } else {
        resultText = `引き分け！<br><br>⚫ ${blackCount} - ${whiteCount} ⚪`;
    }

    document.getElementById('gameResultText').innerHTML = resultText;
    openModal('gameOverModal');
}

// クリックイベント
function handleCanvasClick(e) {
    const rect = gameState.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor(x / gameState.cellSize);
    const row = Math.floor(y / gameState.cellSize);

    if (row >= 0 && row < 8 && col >= 0 && col < 8) {
        placeStone(row, col);
    }
}

// タッチイベント
function handleCanvasTouch(e) {
    e.preventDefault();
    const rect = gameState.canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const col = Math.floor(x / gameState.cellSize);
    const row = Math.floor(y / gameState.cellSize);

    if (row >= 0 && row < 8 && col >= 0 && col < 8) {
        placeStone(row, col);
    }
}

// イベントリスナー初期化
function initGameEventListeners() {
    const canvas = document.getElementById('gameCanvas');
    if (canvas) {
        canvas.addEventListener('click', handleCanvasClick);
        canvas.addEventListener('touchstart', handleCanvasTouch);
    }

    // リセットボタン
    document.getElementById('gameResetBtn')?.addEventListener('click', () => {
        closeModal('gameOverModal');
        initOthelloGame();
    });

    // リトライボタン
    document.getElementById('gameRetryBtn')?.addEventListener('click', () => {
        closeModal('gameOverModal');
        initOthelloGame();
    });
}

// ゲームページに切り替わった時の初期化用関数
function initCharisoGame() {
    // オセロゲーム用にリネーム
    initOthelloGame();
}
