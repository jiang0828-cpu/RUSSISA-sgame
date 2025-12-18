// 基础配置
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 24; // 对应 canvas 高度 480

const COLORS = {
  I: "#00ffff",
  J: "#4169e1",
  L: "#ff8c00",
  O: "#ffd700",
  S: "#32cd32",
  T: "#ba55d3",
  Z: "#ff4c4c",
  GHOST: "rgba(255,255,255,0.2)",
  GRID: "rgba(255,255,255,0.06)",
};

// 方块形状（4x4）
const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

// 画布与状态
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");

let board = createEmptyBoard();
let current;
let nextPiece;
let score = 0;
let lines = 0;
let level = 1;

let dropCounter = 0;
let dropInterval = 800; // 毫秒
let lastTime = 0;

let gameRunning = false;
let gamePaused = false;
let gameOver = false;

function canControl() {
  return gameRunning && !gamePaused && !gameOver;
}

// 工具函数
function createEmptyBoard() {
  const b = [];
  for (let y = 0; y < ROWS; y++) {
    b.push(new Array(COLS).fill(null));
  }
  return b;
}

function randomPieceType() {
  const types = Object.keys(SHAPES);
  return types[Math.floor(Math.random() * types.length)];
}

function createPiece(type) {
  const shape = SHAPES[type].map((row) => row.slice());
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.ceil(shape[0].length / 2),
    y: 0,
  };
}

function rotate(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const res = [];
  for (let x = 0; x < cols; x++) {
    const row = [];
    for (let y = rows - 1; y >= 0; y--) {
      row.push(matrix[y][x]);
    }
    res.push(row);
  }
  return res;
}

function collide(board, piece) {
  const { shape, x: px, y: py } = piece;
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue;
      const boardX = px + x;
      const boardY = py + y;
      if (
        boardX < 0 ||
        boardX >= COLS ||
        boardY >= ROWS ||
        (boardY >= 0 && board[boardY][boardX])
      ) {
        return true;
      }
    }
  }
  return false;
}

function merge(board, piece) {
  const { shape, x: px, y: py, type } = piece;
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) {
        const by = py + y;
        const bx = px + x;
        if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
          board[by][bx] = type;
        }
      }
    }
  }
}

function sweepLines() {
  let cleared = 0;
  outer: for (let y = ROWS - 1; y >= 0; ) {
    if (board[y].every((cell) => cell)) {
      const row = board.splice(y, 1)[0].fill(null);
      board.unshift(row);
      cleared++;
      // 不递减 y，继续检查同一行（因为上移了一行）
    } else {
      y--;
    }
  }

  if (cleared > 0) {
    const lineScores = [0, 100, 300, 500, 800];
    score += lineScores[cleared] * level;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(120, 800 - (level - 1) * 70);
    updateStats();
  }
}

function updateStats() {
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

// 绘制
function drawCell(ctx, x, y, color, cellSize) {
  const s = cellSize || BLOCK_SIZE;
  const px = x * s;
  const py = y * s;

  // 背景块
  ctx.fillStyle = "#050912";
  ctx.fillRect(px, py, s, s);

  // 主色块
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, s - 2, s - 2);

  // 高光与阴影，制造立体感
  const gradient = ctx.createLinearGradient(px, py, px + s, py + s);
  gradient.addColorStop(0, "rgba(255,255,255,0.5)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.15)");
  gradient.addColorStop(0.6, "rgba(0,0,0,0.3)");
  gradient.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = gradient;
  ctx.fillRect(px + 1, py + 1, s - 2, s - 2);

  // 外边框
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 背景
  ctx.fillStyle = "#050814";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 网格
  ctx.strokeStyle = COLORS.GRID;
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK_SIZE + 0.5, 0);
    ctx.lineTo(x * BLOCK_SIZE + 0.5, ROWS * BLOCK_SIZE);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK_SIZE + 0.5);
    ctx.lineTo(COLS * BLOCK_SIZE, y * BLOCK_SIZE + 0.5);
    ctx.stroke();
  }

  // 已固定的方块
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = board[y][x];
      if (cell) {
        drawCell(ctx, x, y, COLORS[cell]);
      }
    }
  }

  if (current) {
    // 影子方块
    const ghost = {
      type: current.type,
      shape: current.shape,
      x: current.x,
      y: current.y,
    };
    while (!collide(board, { ...ghost, y: ghost.y + 1 })) {
      ghost.y++;
    }
    drawPiece(ghost, COLORS.GHOST, true);

    // 当前方块
    drawPiece(current, COLORS[current.type]);
  }

  if (gameOver) {
    drawGameOver();
  }
}

function drawPiece(piece, color, isGhost = false) {
  const { shape, x: px, y: py } = piece;
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue;
      const by = py + y;
      const bx = px + x;
      if (by < 0) continue;
      if (isGhost) {
        // 影子方块简单一点
        ctx.fillStyle = color;
        ctx.fillRect(
          bx * BLOCK_SIZE + 4,
          by * BLOCK_SIZE + 4,
          BLOCK_SIZE - 8,
          BLOCK_SIZE - 8
        );
      } else {
        drawCell(ctx, bx, by, color);
      }
    }
  }
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!nextPiece) return;

  const shape = nextPiece.shape;
  const rows = shape.length;
  const cols = shape[0].length;

  const cell = 24;
  const paddingX = (nextCanvas.width - cols * cell) / 2;
  const paddingY = (nextCanvas.height - rows * cell) / 2;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!shape[y][x]) continue;
      const px = paddingX + x * cell;
      const py = paddingY + y * cell;

      nextCtx.fillStyle = COLORS[nextPiece.type];
      nextCtx.fillRect(px + 1, py + 1, cell - 2, cell - 2);

      const gradient = nextCtx.createLinearGradient(px, py, px + cell, py + cell);
      gradient.addColorStop(0, "rgba(255,255,255,0.6)");
      gradient.addColorStop(0.4, "rgba(255,255,255,0.15)");
      gradient.addColorStop(0.6, "rgba(0,0,0,0.3)");
      gradient.addColorStop(1, "rgba(0,0,0,0.7)");
      nextCtx.fillStyle = gradient;
      nextCtx.fillRect(px + 1, py + 1, cell - 2, cell - 2);

      nextCtx.strokeStyle = "rgba(0,0,0,0.8)";
      nextCtx.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
    }
  }
}

function drawGameOver() {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, canvas.height / 2 - 40, canvas.width, 80);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI'";
  ctx.textAlign = "center";
  ctx.fillText("游戏结束", canvas.width / 2, canvas.height / 2 - 4);
  ctx.font = "14px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI'";
  ctx.fillText(
    "按“开始 / 重新开始”键重新开始",
    canvas.width / 2,
    canvas.height / 2 + 20
  );
}

// 游戏流程
function spawnPiece() {
  if (!nextPiece) {
    nextPiece = createPiece(randomPieceType());
  }
  current = nextPiece;
  nextPiece = createPiece(randomPieceType());
  drawNext();

  // 出生时就碰撞说明游戏结束
  if (collide(board, current)) {
    gameOver = true;
    gameRunning = false;
  }
}

function playerMove(dir) {
  if (!current) return;
  const moved = { ...current, x: current.x + dir };
  if (!collide(board, moved)) {
    current.x = moved.x;
    drawBoard();
  }
}

function playerRotate() {
  if (!current) return;
  const rotated = {
    ...current,
    shape: rotate(current.shape),
  };

  // 简单蹭墙（wall kick）
  if (!collide(board, rotated)) {
    current.shape = rotated.shape;
  } else {
    rotated.x++;
    if (!collide(board, rotated)) {
      current.x++;
      current.shape = rotated.shape;
    } else {
      rotated.x -= 2;
      if (!collide(board, rotated)) {
        current.x -= 1;
        current.shape = rotated.shape;
      }
    }
  }
  drawBoard();
}

function hardDrop() {
  if (!current) return;
  while (!collide(board, { ...current, y: current.y + 1 })) {
    current.y++;
  }
  pieceLock();
}

function pieceLock() {
  merge(board, current);
  sweepLines();
  spawnPiece();
  drawBoard();
}

function playerSoftDrop() {
  if (!current) return;
  const moved = { ...current, y: current.y + 1 };
  if (!collide(board, moved)) {
    current.y++;
    score += 1; // 软降给一点分
  } else {
    pieceLock();
  }
  drawBoard();
}

function update(time = 0) {
  if (!gameRunning || gamePaused) {
    drawBoard();
    requestAnimationFrame(update);
    return;
  }

  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;

  if (dropCounter > dropInterval) {
    playerSoftDrop();
    dropCounter = 0;
  }

  drawBoard();
  requestAnimationFrame(update);
}

function resetGame() {
  board = createEmptyBoard();
  score = 0;
  lines = 0;
  level = 1;
  dropInterval = 800;
  gameOver = false;
  nextPiece = null;
  spawnPiece();
  updateStats();
  drawBoard();
}

function startGame() {
  resetGame();
  gameRunning = true;
  gamePaused = false;
}

function togglePause() {
  if (!gameRunning) return;
  gamePaused = !gamePaused;
}

// 键盘控制
window.addEventListener("keydown", (e) => {
  if (!canControl()) return;

  switch (e.key) {
    case "ArrowLeft":
      e.preventDefault();
      playerMove(-1);
      break;
    case "ArrowRight":
      e.preventDefault();
      playerMove(1);
      break;
    case "ArrowDown":
      e.preventDefault();
      playerSoftDrop();
      dropCounter = 0;
      break;
    case "ArrowUp":
      e.preventDefault();
      playerRotate();
      break;
    case " ":
      e.preventDefault();
      hardDrop();
      dropCounter = 0;
      break;
  }
});

// 按钮控制
document.getElementById("btn-start").addEventListener("click", () => {
  startGame();
});

document.getElementById("btn-pause").addEventListener("click", () => {
  togglePause();
});

// 触摸按钮（手机控制）
const btnLeft = document.getElementById("btn-left");
const btnRight = document.getElementById("btn-right");
const btnDown = document.getElementById("btn-down");
const btnRotate = document.getElementById("btn-rotate");
const btnHardDrop = document.getElementById("btn-hard-drop");

function bindTouchButton(el, action) {
  if (!el) return;
  const handler = (e) => {
    e.preventDefault();
    if (!canControl()) return;
    action();
  };
  el.addEventListener("click", handler);
  el.addEventListener("touchstart", handler, { passive: false });
}

bindTouchButton(btnLeft, () => playerMove(-1));
bindTouchButton(btnRight, () => playerMove(1));
bindTouchButton(btnDown, () => {
  playerSoftDrop();
  dropCounter = 0;
});
bindTouchButton(btnRotate, () => playerRotate());
bindTouchButton(btnHardDrop, () => {
  hardDrop();
  dropCounter = 0;
});

// 初始绘制
drawBoard();
updateStats();
drawNext();
requestAnimationFrame(update);



