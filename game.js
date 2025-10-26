// ==========================================
// チャリ走ゲーム
// ==========================================

const gameState = {
    canvas: null,
    ctx: null,
    running: false,
    score: 0,
    distance: 0,
    gameSpeed: 5, // 初期速度を5に下げる
    spawnRate: 0.01, // 出現頻度を0.01に下げる
    player: {
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        velocityY: 0,
        isJumping: false
    },
    obstacles: [],
    clouds: [],
    groundY: 0
};

// ゲーム初期化
function initCharisoGame() {
    gameState.canvas = document.getElementById('gameCanvas');
    if (!gameState.canvas) return;

    gameState.ctx = gameState.canvas.getContext('2d');
    gameState.canvas.width = gameState.canvas.offsetWidth;
    gameState.canvas.height = gameState.canvas.offsetHeight;

    gameState.score = 0;
    gameState.distance = 0;
    gameState.gameSpeed = 5; // 初期速度5
    gameState.spawnRate = 0.01; // 出現頻度低め
    gameState.player.y = gameState.canvas.height - 80;
    gameState.player.x = 50;
    gameState.groundY = gameState.canvas.height - 30;
    gameState.obstacles = [];
    gameState.running = false;

    // 雲を生成
    gameState.clouds = [];
    for (let i = 0; i < 5; i++) {
        gameState.clouds.push({
            x: Math.random() * gameState.canvas.width,
            y: Math.random() * (gameState.canvas.height * 0.3),
            width: 60,
            height: 30,
            speed: 1 + Math.random() * 0.5
        });
    }

    updateGameDisplay();
}

// ゲーム開始
function startCharisoGame() {
    if (!gameState.canvas) {
        initCharisoGame();
    }
    gameState.running = true;
    gameState.score = 0;
    gameState.distance = 0;
    gameState.gameSpeed = 5;
    gameState.spawnRate = 0.01;
    gameState.obstacles = [];
    document.getElementById('gameStartBtn').disabled = true;
    charisoGameLoop();
}

// ゲームループ
function charisoGameLoop() {
    if (!gameState.running) return;

    const ctx = gameState.ctx;
    const canvas = gameState.canvas;

    // 背景
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#E0F6FF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 雲
    gameState.clouds.forEach(cloud => {
        cloud.x -= cloud.speed;
        if (cloud.x + cloud.width < 0) {
            cloud.x = canvas.width;
        }
        drawCloud(ctx, cloud.x, cloud.y, cloud.width, cloud.height);
    });

    // 地面
    ctx.fillStyle = '#90EE90';
    ctx.fillRect(0, gameState.groundY, canvas.width, 30);

    ctx.fillStyle = '#7CCD7C';
    for (let i = 0; i < canvas.width; i += 40) {
        ctx.fillRect(i - (gameState.distance % 40), gameState.groundY, 20, 30);
    }

    // プレイヤー更新
    gameState.player.velocityY += 0.8;
    gameState.player.y += gameState.player.velocityY;

    if (gameState.player.y + gameState.player.height >= gameState.groundY) {
        gameState.player.y = gameState.groundY - gameState.player.height;
        gameState.player.isJumping = false;
        gameState.player.velocityY = 0;
    }

    drawBike(ctx, gameState.player.x, gameState.player.y, gameState.player.width, gameState.player.height);

    // 障害物追加
    if (Math.random() < gameState.spawnRate) {
        const obstacleType = Math.random() < 0.7 ? 'rock' : 'tree';
        gameState.obstacles.push({
            x: canvas.width,
            y: gameState.groundY - 30,
            width: 30,
            height: 30,
            type: obstacleType
        });

        // スコア10ごとに速度上昇を緩やかに
        if (gameState.score % 10 === 0 && gameState.score > 0) {
            gameState.gameSpeed += 0.2; // 0.5から0.2に変更
            gameState.spawnRate += 0.003;
        }
    }

    // 障害物更新
    gameState.obstacles.forEach((obstacle, index) => {
        obstacle.x -= gameState.gameSpeed;

        if (obstacle.type === 'rock') {
            ctx.fillStyle = '#8B8B8B';
            ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            ctx.fillStyle = '#696969';
            ctx.fillRect(obstacle.x + 8, obstacle.y + 8, 8, 8);
        } else {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(obstacle.x + 10, obstacle.y + 15, 10, 15);
            ctx.fillStyle = '#228B22';
            ctx.beginPath();
            ctx.arc(obstacle.x + 15, obstacle.y + 10, 12, 0, Math.PI * 2);
            ctx.fill();
        }

        if (obstacle.x + obstacle.width < 0) {
            gameState.obstacles.splice(index, 1);
            gameState.score += 10;
            gameState.distance += 5;
            updateGameDisplay();
        }

        if (checkGameCollision(gameState.player, obstacle)) {
            endCharisoGame();
        }
    });

    // UI
    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`スコア: ${gameState.score}`, 10, 25);
    ctx.font = '12px Arial';
    ctx.fillText(`距離: ${gameState.distance}m`, 10, 45);
    ctx.fillText(`速度: ${(gameState.gameSpeed * 10).toFixed(1)} km/h`, 10, 60);

    requestAnimationFrame(charisoGameLoop);
}

// チャリンコ描画
function drawBike(ctx, x, y, width, height) {
    ctx.fillStyle = '#FF6B6B';
    ctx.fillRect(x + 8, y + 10, 24, 15);

    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(x + 20, y + 5, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 15, y + 25);
    ctx.lineTo(x + 12, y + 35);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + 10, y + 35, 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + 30, y + 35, 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 35);
        ctx.lineTo(x + 10 + Math.cos(angle) * 5, y + 35 + Math.sin(angle) * 5);
        ctx.stroke();
    }
}

// 雲描画
function drawCloud(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(x, y, h / 2, 0, Math.PI * 2);
    ctx.arc(x + w / 3, y - h / 4, h / 2.5, 0, Math.PI * 2);
    ctx.arc(x + w / 1.5, y - h / 4, h / 2.5, 0, Math.PI * 2);
    ctx.arc(x + w, y, h / 2, 0, Math.PI * 2);
    ctx.fill();
}

// 衝突判定
function checkGameCollision(player, obstacle) {
    return player.x < obstacle.x + obstacle.width &&
           player.x + player.width > obstacle.x &&
           player.y < obstacle.y + obstacle.height &&
           player.y + player.height > obstacle.y;
}

// ゲーム終了
function endCharisoGame() {
    gameState.running = false;
    document.getElementById('gameStartBtn').disabled = false;
    document.getElementById('gameResultText').innerHTML =
        `🏆 スコア: ${gameState.score}<br>📏 距離: ${gameState.distance}m`;
    openModal('gameOverModal');
}

// 表示更新
function updateGameDisplay() {
    document.getElementById('gameScoreDisplay').textContent = gameState.score;
    document.getElementById('gameDistanceDisplay').textContent = gameState.distance + 'm';
}

// ゲームのキーボード操作
function handleGameKeydown(e) {
    const currentPage = document.querySelector('.page-content:not([style*="display: none"])');
    if (!currentPage || currentPage.id !== 'gamePage') return;
    if (!gameState.running) return;

    if ((e.code === 'Space' || e.code === 'ArrowUp') && !gameState.player.isJumping) {
        e.preventDefault(); // スペースキーのスクロールを防ぐ
        gameState.player.velocityY = -18; // ジャンプ力を-15から-18に上げる
        gameState.player.isJumping = true;
    }
}

// ゲームのイベントリスナー初期化
function initGameEventListeners() {
    // キーボード操作
    document.addEventListener('keydown', handleGameKeydown);

    // タッチ/クリック操作
    const canvas = document.getElementById('gameCanvas');
    if (canvas) {
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!gameState.running) return;
            if (!gameState.player.isJumping) {
                gameState.player.velocityY = -18;
                gameState.player.isJumping = true;
            }
        });

        canvas.addEventListener('click', () => {
            if (!gameState.running) return;
            if (!gameState.player.isJumping) {
                gameState.player.velocityY = -18;
                gameState.player.isJumping = true;
            }
        });
    }

    // ボタン操作
    document.getElementById('gameStartBtn')?.addEventListener('click', startCharisoGame);
    document.getElementById('gameResetBtn')?.addEventListener('click', () => {
        gameState.running = false;
        closeModal('gameOverModal');
        document.getElementById('gameStartBtn').disabled = false;
        initCharisoGame();
    });
    document.getElementById('gameRetryBtn')?.addEventListener('click', () => {
        closeModal('gameOverModal');
        startCharisoGame();
    });
}
