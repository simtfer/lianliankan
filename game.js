(function () {
  'use strict';

  const config = {
    topBarHeight: 80,
    bottomBarHeight: 90,
    cellSize: 50,
    levels: [
      { rows: 6, cols: 6, types: 6, time: 120 },
      { rows: 6, cols: 8, types: 8, time: 150 },
      { rows: 8, cols: 8, types: 10, time: 180 },
      { rows: 8, cols: 10, types: 12, time: 200 },
      { rows: 10, cols: 10, types: 12, time: 240 }
    ]
  };

  const ICON_TYPES = [
    { color: '#FF6B6B', emoji: '★' },
    { color: '#4ECDC4', emoji: '●' },
    { color: '#FFE66D', emoji: '▲' },
    { color: '#95E1D3', emoji: '◆' },
    { color: '#F38181', emoji: '■' },
    { color: '#AA96DA', emoji: '♥' },
    { color: '#FCBAD3', emoji: '♠' },
    { color: '#A8D8EA', emoji: '♣' },
    { color: '#FFD3B6', emoji: '♥' },
    { color: '#B5EAD7', emoji: '✿' },
    { color: '#C7CEEA', emoji: '☀' },
    { color: '#FFDAC1', emoji: '☾' }
  ];

  const STATE = {
    START: 'start',
    PLAYING: 'playing',
    WIN: 'win',
    LOSE: 'lose'
  };

  let gameState = STATE.START;
  let canvas = null;
  let ctx = null;
  let board = null;
  let score = 0;
  let level = 1;
  let timeLeft = 0;
  let hintCount = 3;
  let shuffleCount = 3;
  let lastTime = 0;
  let selectedCell = null;
  let canvasWidth = 375;
  let canvasHeight = 667;
  let cellSize = 50;
  let offsetX = 0;
  let offsetY = 0;
  let rows = 0;
  let cols = 0;
  let linkPath = null;
  let linkProgress = 0;
  let hintCells = null;
  let hintTimer = 0;
  let wrongShake = null;
  let wrongShakeTimer = 0;
  let cellPulse = {};
  let startBtn = null;
  let restartBtn = null;
  let hintBtn = null;
  let shuffleBtn = null;

  // ========= 棋盘核心逻辑 =========
  function createBoard(r, c, typeCount) {
    const pairs = [];
    const pairsNeeded = r * c / 2;
    for (let i = 0; i < pairsNeeded; i++) {
      const typeIdx = i % typeCount;
      pairs.push(typeIdx, typeIdx);
    }
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = pairs[i];
      pairs[i] = pairs[j];
      pairs[j] = temp;
    }
    const result = [];
    let idx = 0;
    for (let ri = 0; ri < r; ri++) {
      result[ri] = [];
      for (let ci = 0; ci < c; ci++) {
        result[ri][ci] = { type: pairs[idx], removed: false };
        idx++;
      }
    }
    return result;
  }

  function isEmpty(r, c) {
    if (r < -1 || r > rows || c < -1 || c > cols) return false;
    if (r === -1 || r === rows || c === -1 || c === cols) return true;
    return board[r][c].removed;
  }

  function straightLine(r1, c1, r2, c2) {
    if (r1 === r2) {
      const minC = Math.min(c1, c2);
      const maxC = Math.max(c1, c2);
      for (let c = minC + 1; c < maxC; c++) {
        if (!isEmpty(r1, c)) return false;
      }
      return true;
    }
    if (c1 === c2) {
      const minR = Math.min(r1, r2);
      const maxR = Math.max(r1, r2);
      for (let r = minR + 1; r < maxR; r++) {
        if (!isEmpty(r, c1)) return false;
      }
      return true;
    }
    return false;
  }

  function findPath(cell1, cell2) {
    if (straightLine(cell1.row, cell1.col, cell2.row, cell2.col)) {
      return [{ row: cell1.row, col: cell1.col }, { row: cell2.row, col: cell2.col }];
    }
    const corners1 = [
      { row: cell1.row, col: cell2.col },
      { row: cell2.row, col: cell1.col }
    ];
    for (let i = 0; i < corners1.length; i++) {
      const corner = corners1[i];
      if (isEmpty(corner.row, corner.col) &&
          straightLine(cell1.row, cell1.col, corner.row, corner.col) &&
          straightLine(corner.row, corner.col, cell2.row, cell2.col)) {
        return [
          { row: cell1.row, col: cell1.col },
          corner,
          { row: cell2.row, col: cell2.col }
        ];
      }
    }
    for (let c = -1; c <= cols; c++) {
      if (c === cell1.col || c === cell2.col) continue;
      const corner1 = { row: cell1.row, col: c };
      const corner2 = { row: cell2.row, col: c };
      if (isEmpty(corner1.row, corner1.col) &&
          isEmpty(corner2.row, corner2.col) &&
          straightLine(cell1.row, cell1.col, corner1.row, corner1.col) &&
          straightLine(corner1.row, corner1.col, corner2.row, corner2.col) &&
          straightLine(corner2.row, corner2.col, cell2.row, cell2.col)) {
        return [
          { row: cell1.row, col: cell1.col },
          corner1,
          corner2,
          { row: cell2.row, col: cell2.col }
        ];
      }
    }
    for (let r = -1; r <= rows; r++) {
      if (r === cell1.row || r === cell2.row) continue;
      const corner1 = { row: r, col: cell1.col };
      const corner2 = { row: r, col: cell2.col };
      if (isEmpty(corner1.row, corner1.col) &&
          isEmpty(corner2.row, corner2.col) &&
          straightLine(cell1.row, cell1.col, corner1.row, corner1.col) &&
          straightLine(corner1.row, corner1.col, corner2.row, corner2.col) &&
          straightLine(corner2.row, corner2.col, cell2.row, cell2.col)) {
        return [
          { row: cell1.row, col: cell1.col },
          corner1,
          corner2,
          { row: cell2.row, col: cell2.col }
        ];
      }
    }
    return null;
  }

  function hasAnyMatch() {
    const activeCells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!board[r][c].removed) {
          activeCells.push({ row: r, col: c });
        }
      }
    }
    for (let i = 0; i < activeCells.length; i++) {
      for (let j = i + 1; j < activeCells.length; j++) {
        const c1 = activeCells[i];
        const c2 = activeCells[j];
        if (board[c1.row][c1.col].type === board[c2.row][c2.col].type) {
          if (findPath(c1, c2)) {
            return { cell1: c1, cell2: c2 };
          }
        }
      }
    }
    return null;
  }

  function isCleared() {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!board[r][c].removed) return false;
      }
    }
    return true;
  }

  function shuffleBoard() {
    const activeTypes = [];
    const activePositions = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!board[r][c].removed) {
          activeTypes.push(board[r][c].type);
          activePositions.push({ row: r, col: c });
        }
      }
    }
    let attempts = 0;
    do {
      for (let i = activeTypes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = activeTypes[i];
        activeTypes[i] = activeTypes[j];
        activeTypes[j] = temp;
      }
      for (let i = 0; i < activePositions.length; i++) {
        const pos = activePositions[i];
        board[pos.row][pos.col].type = activeTypes[i];
      }
      attempts++;
    } while (!hasAnyMatch() && attempts < 50);
  }

  // ========= 渲染工具 =========
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function shadeColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    const rC = R < 255 ? (R < 1 ? 0 : R) : 255;
    const gC = G < 255 ? (G < 1 ? 0 : G) : 255;
    const bC = B < 255 ? (B < 1 ? 0 : B) : 255;
    return 'rgb(' + rC + ',' + gC + ',' + bC + ')';
  }

  // ========= 布局 =========
  function recalcLayout() {
    const boardPadding = 20;
    const availableWidth = canvasWidth - boardPadding * 2;
    const availableHeight = canvasHeight - config.topBarHeight - config.bottomBarHeight - boardPadding * 2;
    const maxCellWidth = availableWidth / cols;
    const maxCellHeight = availableHeight / rows;
    cellSize = Math.min(maxCellWidth, maxCellHeight, config.cellSize);
    const boardWidth = cellSize * cols;
    const boardHeight = cellSize * rows;
    offsetX = (canvasWidth - boardWidth) / 2;
    offsetY = config.topBarHeight + boardPadding;
  }

  function pixelToCell(x, y) {
    const c = Math.floor((x - offsetX) / cellSize);
    const r = Math.floor((y - offsetY) / cellSize);
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      return { row: r, col: c };
    }
    return null;
  }

  // ========= 绘制函数 =========
  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let i = 0; i < 40; i++) {
      const x = (i * 73) % canvasWidth;
      const y = (i * 137) % canvasHeight;
      const r = 2 + (i % 4);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCell(row, col, type, isSelected, isHint) {
    const size = cellSize;
    const padding = size * 0.08;
    const x = offsetX + col * size + padding;
    const y = offsetY + row * size + padding;
    const cellW = size - padding * 2;
    const cellH = size - padding * 2;

    let offX = 0;
    let offY = 0;
    let scale = 1;

    const pulseKey = row + ',' + col;
    if (cellPulse[pulseKey]) {
      scale = 1 + Math.sin(cellPulse[pulseKey].phase) * 0.08;
    }
    if (wrongShake &&
        ((wrongShake.row1 === row && wrongShake.col1 === col) ||
         (wrongShake.row2 === row && wrongShake.col2 === col))) {
      offX = Math.sin(wrongShakeTimer * 0.5) * 4;
    }

    ctx.save();
    ctx.translate(x + cellW / 2 + offX, y + cellH / 2 + offY);
    ctx.scale(scale, scale);
    ctx.translate(-(x + cellW / 2), -(y + cellH / 2));

    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;

    const iconInfo = ICON_TYPES[type];
    const radius = cellW * 0.18;

    roundRect(x, y, cellW, cellH, radius);
    const bgGradient = ctx.createLinearGradient(x, y, x, y + cellH);
    bgGradient.addColorStop(0, iconInfo.color);
    bgGradient.addColorStop(1, shadeColor(iconInfo.color, -20));
    ctx.fillStyle = bgGradient;
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    if (isSelected) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      roundRect(x - 2, y - 2, cellW + 4, cellH + 4, radius);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.4 + Math.sin(Date.now() / 200) * 0.2) + ')';
      ctx.lineWidth = 2;
      roundRect(x - 6, y - 6, cellW + 12, cellH + 12, radius + 4);
      ctx.stroke();
    }

    if (isHint) {
      ctx.strokeStyle = 'rgba(255, 215, 0, ' + (0.5 + Math.sin(Date.now() / 150) * 0.3) + ')';
      ctx.lineWidth = 4;
      roundRect(x - 3, y - 3, cellW + 6, cellH + 6, radius);
      ctx.stroke();
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold ' + Math.floor(cellW * 0.5) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(iconInfo.emoji, x + cellW / 2, y + cellH / 2);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.ellipse(x + cellW / 2, y + cellH * 0.3, cellW * 0.25, cellH * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawBoard() {
    const boardW = cellSize * cols;
    const boardH = cellSize * rows;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    roundRect(offsetX - 10, offsetY - 10, boardW + 20, boardH + 20, 12);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let r = 0; r <= rows; r++) {
      const y = offsetY + r * cellSize;
      ctx.beginPath();
      ctx.moveTo(offsetX, y);
      ctx.lineTo(offsetX + boardW, y);
      ctx.stroke();
    }
    for (let c = 0; c <= cols; c++) {
      const x = offsetX + c * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, offsetY);
      ctx.lineTo(x, offsetY + boardH);
      ctx.stroke();
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!board[r][c].removed) {
          const isSelected = selectedCell && selectedCell.row === r && selectedCell.col === c;
          const isHint = hintCells &&
            ((hintCells.cell1.row === r && hintCells.cell1.col === c) ||
             (hintCells.cell2.row === r && hintCells.cell2.col === c));
          drawCell(r, c, board[r][c].type, isSelected, isHint);
        }
      }
    }
  }

  function drawLinkPath() {
    if (!linkPath) return;

    const points = [];
    for (let i = 0; i < linkPath.length; i++) {
      const cx = offsetX + linkPath[i].col * cellSize + cellSize / 2;
      const cy = offsetY + linkPath[i].row * cellSize + cellSize / 2;
      points.push({ x: cx, y: cy });
    }

    ctx.strokeStyle = 'rgba(255, 215, 0, ' + (1 - linkProgress * 0.5) + ')';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
    ctx.shadowBlur = 10;

    let totalLen = 0;
    for (let i = 1; i < points.length; i++) {
      totalLen += Math.sqrt(
        (points[i].x - points[i - 1].x) * (points[i].x - points[i - 1].x) +
        (points[i].y - points[i - 1].y) * (points[i].y - points[i - 1].y));
    }
    const drawLen = totalLen * Math.min(linkProgress, 1);
    let accLen = 0;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (accLen + segLen <= drawLen) {
        ctx.lineTo(points[i].x, points[i].y);
        accLen += segLen;
      } else {
        const remain = drawLen - accLen;
        const ratio = segLen > 0 ? remain / segLen : 0;
        const interpX = points[i - 1].x + dx * ratio;
        const interpY = points[i - 1].y + dy * ratio;
        ctx.lineTo(interpX, interpY);
        break;
      }
    }
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  function drawTopBar() {
    const barH = config.topBarHeight;
    const bg = ctx.createLinearGradient(0, 0, 0, barH);
    bg.addColorStop(0, 'rgba(30, 30, 60, 0.9)');
    bg.addColorStop(1, 'rgba(30, 30, 60, 0.6)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvasWidth, barH);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(0, barH - 2, canvasWidth, 2);

    ctx.fillStyle = '#FFE66D';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('分数', 20, barH / 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(score, 70, barH / 2);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#4ECDC4';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('关卡', canvasWidth / 2, barH / 2 - 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('第 ' + level + ' 关', canvasWidth / 2, barH / 2 + 14);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#FF6B6B';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('时间', canvasWidth - 80, barH / 2);
    ctx.fillStyle = timeLeft < 10 ? '#FF6B6B' : '#FFFFFF';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(Math.ceil(timeLeft) + 's', canvasWidth - 20, barH / 2);
  }

  function drawButton(btn, text, color) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    const gradient = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, shadeColor(color, -15));
    ctx.fillStyle = gradient;
    roundRect(btn.x, btn.y, btn.w, btn.h, 12);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, btn.x + btn.w / 2, btn.y + btn.h / 2);
  }

  function drawBottomBar() {
    const barY = canvasHeight - config.bottomBarHeight;
    const barH = config.bottomBarHeight;
    const bg = ctx.createLinearGradient(0, barY, 0, canvasHeight);
    bg.addColorStop(0, 'rgba(30, 30, 60, 0.6)');
    bg.addColorStop(1, 'rgba(30, 30, 60, 0.9)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, barY, canvasWidth, barH);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(0, barY, canvasWidth, 2);

    const btnW = (canvasWidth - 80) / 2;
    const btnH = barH - 20;
    const btnY = barY + 10;
    hintBtn = { x: 20, y: btnY, w: btnW, h: btnH };
    shuffleBtn = { x: canvasWidth - btnW - 20, y: btnY, w: btnW, h: btnH };

    drawButton(hintBtn, '提示 (' + hintCount + ')', '#FFE66D');
    drawButton(shuffleBtn, '重排 (' + shuffleCount + ')', '#4ECDC4');
  }

  function drawStartScreen() {
    drawBackground();

    ctx.fillStyle = '#FFE66D';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 230, 109, 0.5)';
    ctx.shadowBlur = 20;
    ctx.fillText('连连看', canvasWidth / 2, canvasHeight * 0.25);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('经典益智游戏', canvasWidth / 2, canvasHeight * 0.33);

    const demoIcons = ['★', '●', '▲', '◆', '■', '♥'];
    ctx.font = '36px sans-serif';
    const spacing = canvasWidth / (demoIcons.length + 1);
    for (let i = 0; i < demoIcons.length; i++) {
      const x = spacing * (i + 1);
      const y = canvasHeight * 0.45 + Math.sin(Date.now() / 500 + i) * 8;
      ctx.fillStyle = ICON_TYPES[i].color;
      ctx.fillText(demoIcons[i], x, y);
    }

    const btnW = Math.min(240, canvasWidth * 0.6);
    const btnH = 70;
    const btnX = (canvasWidth - btnW) / 2;
    const btnY = canvasHeight * 0.65;
    startBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

    ctx.shadowColor = 'rgba(78, 205, 196, 0.5)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 4;
    const gradient = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
    gradient.addColorStop(0, '#4ECDC4');
    gradient.addColorStop(1, '#3BA99E');
    ctx.fillStyle = gradient;
    roundRect(btnX, btnY, btnW, btnH, 16);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('开始游戏', btnX + btnW / 2, btnY + btnH / 2);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '16px sans-serif';
    ctx.fillText('点击两个相同图案，连线不超过3段即可消除', canvasWidth / 2, canvasHeight * 0.82);
    ctx.fillText('消除所有图案即为过关', canvasWidth / 2, canvasHeight * 0.87);
  }

  function drawEndScreen(isWin) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const titleColor = isWin ? '#FFE66D' : '#FF6B6B';
    const titleText = isWin ? '恭喜过关！' : '时间到！';

    ctx.fillStyle = titleColor;
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = isWin ? 'rgba(255, 230, 109, 0.5)' : 'rgba(255, 107, 107, 0.5)';
    ctx.shadowBlur = 15;
    ctx.fillText(titleText, canvasWidth / 2, canvasHeight * 0.3);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px sans-serif';
    ctx.fillText('第 ' + level + ' 关', canvasWidth / 2, canvasHeight * 0.4);
    ctx.fillText('总分: ' + score, canvasWidth / 2, canvasHeight * 0.47);

    if (isWin) {
      ctx.fillStyle = '#4ECDC4';
      ctx.font = '20px sans-serif';
      ctx.fillText('继续挑战下一关吧！', canvasWidth / 2, canvasHeight * 0.54);
    } else {
      ctx.fillStyle = '#AA96DA';
      ctx.font = '20px sans-serif';
      ctx.fillText('别气馁，再来一次！', canvasWidth / 2, canvasHeight * 0.54);
    }

    const btnW = Math.min(240, canvasWidth * 0.6);
    const btnH = 70;
    const btnX = (canvasWidth - btnW) / 2;
    const btnY = canvasHeight * 0.68;
    restartBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

    ctx.shadowColor = 'rgba(78, 205, 196, 0.5)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 4;
    const gradient = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
    gradient.addColorStop(0, '#4ECDC4');
    gradient.addColorStop(1, '#3BA99E');
    ctx.fillStyle = gradient;
    roundRect(btnX, btnY, btnW, btnH, 16);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(isWin ? '下一关' : '再来一次', btnX + btnW / 2, btnY + btnH / 2);
  }

  // ========= 游戏流程 =========
  function startGame() {
    gameState = STATE.PLAYING;
    score = 0;
    level = 1;
    hintCount = 3;
    shuffleCount = 3;
    startLevel();
  }

  function startLevel() {
    const levelConfig = config.levels[Math.min(level - 1, config.levels.length - 1)];
    rows = levelConfig.rows;
    cols = levelConfig.cols;
    board = createBoard(rows, cols, levelConfig.types);

    let attempts = 0;
    while (!hasAnyMatch() && attempts < 20) {
      board = createBoard(rows, cols, levelConfig.types);
      attempts++;
    }
    timeLeft = levelConfig.time;
    selectedCell = null;
    recalcLayout();
  }

  function handleCellClick(cell) {
    if (board[cell.row][cell.col].removed) {
      return;
    }

    if (!selectedCell) {
      selectedCell = cell;
      return;
    }

    if (selectedCell.row === cell.row && selectedCell.col === cell.col) {
      selectedCell = null;
      return;
    }

    const sameType = board[selectedCell.row][selectedCell.col].type === board[cell.row][cell.col].type;
    if (sameType) {
      const path = findPath(selectedCell, cell);
      if (path) {
        linkPath = path;
        linkProgress = 0;
        cellPulse[selectedCell.row + ',' + selectedCell.col] = { phase: 0 };
        cellPulse[cell.row + ',' + cell.col] = { phase: 0 };

        const toRemove1 = { row: selectedCell.row, col: selectedCell.col };
        const toRemove2 = { row: cell.row, col: cell.col };
        setTimeout(function () {
          board[toRemove1.row][toRemove1.col].removed = true;
          board[toRemove2.row][toRemove2.col].removed = true;
          score += 10 * level;
          if (isCleared()) {
            score += Math.floor(timeLeft) * 5;
            gameState = STATE.WIN;
          } else if (!hasAnyMatch()) {
            shuffleBoard();
          }
        }, 300);

        selectedCell = null;
      } else {
        wrongShake = {
          row1: selectedCell.row, col1: selectedCell.col,
          row2: cell.row, col2: cell.col
        };
        wrongShakeTimer = 0;
        selectedCell = cell;
      }
    } else {
      wrongShake = {
        row1: selectedCell.row, col1: selectedCell.col,
        row2: cell.row, col2: cell.col
      };
      wrongShakeTimer = 0;
      selectedCell = cell;
    }
  }

  function handleInput(x, y) {
    if (gameState === STATE.START) {
      if (startBtn && x >= startBtn.x && x <= startBtn.x + startBtn.w &&
          y >= startBtn.y && y <= startBtn.y + startBtn.h) {
        startGame();
      }
      return;
    }

    if (gameState === STATE.WIN || gameState === STATE.LOSE) {
      if (restartBtn && x >= restartBtn.x && x <= restartBtn.x + restartBtn.w &&
          y >= restartBtn.y && y <= restartBtn.y + restartBtn.h) {
        if (gameState === STATE.WIN) {
          level++;
          if (level > config.levels.length) {
            level = config.levels.length;
          }
          hintCount = Math.min(hintCount + 2, 5);
          shuffleCount = Math.min(shuffleCount + 2, 5);
        } else {
          level = 1;
          score = 0;
          hintCount = 3;
          shuffleCount = 3;
        }
        gameState = STATE.PLAYING;
        startLevel();
      }
      return;
    }

    if (gameState === STATE.PLAYING) {
      if (hintBtn && x >= hintBtn.x && x <= hintBtn.x + hintBtn.w &&
          y >= hintBtn.y && y <= hintBtn.y + hintBtn.h) {
        if (hintCount > 0) {
          const hint = hasAnyMatch();
          if (hint) {
            hintCount--;
            hintCells = hint;
            hintTimer = 0;
          }
        }
        return;
      }
      if (shuffleBtn && x >= shuffleBtn.x && x <= shuffleBtn.x + shuffleBtn.w &&
          y >= shuffleBtn.y && y <= shuffleBtn.y + shuffleBtn.h) {
        if (shuffleCount > 0) {
          shuffleCount--;
          shuffleBoard();
          selectedCell = null;
        }
        return;
      }

      const cell = pixelToCell(x, y);
      if (cell) {
        handleCellClick(cell);
      }
    }
  }

  // ========= 动画 & 主循环 =========
  function updateAnimations(deltaTime) {
    if (linkPath) {
      linkProgress += deltaTime * 2;
      if (linkProgress >= 1.5) {
        linkPath = null;
        linkProgress = 0;
      }
    }
    if (hintCells) {
      hintTimer += deltaTime;
      if (hintTimer > 3) {
        hintCells = null;
        hintTimer = 0;
      }
    }
    if (wrongShake) {
      wrongShakeTimer += deltaTime * 30;
      if (wrongShakeTimer > 20) {
        wrongShake = null;
        wrongShakeTimer = 0;
      }
    }
    for (const key in cellPulse) {
      if (cellPulse.hasOwnProperty(key)) {
        cellPulse[key].phase += deltaTime * 8;
        if (cellPulse[key].phase > Math.PI * 3) {
          delete cellPulse[key];
        }
      }
    }
  }

  function render(deltaTime) {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (gameState === STATE.START) {
      drawStartScreen();
      return;
    }

    if (gameState === STATE.PLAYING) {
      updateAnimations(deltaTime);
      drawBackground();
      drawTopBar();
      drawBoard();
      drawBottomBar();
      drawLinkPath();
    }

    if (gameState === STATE.WIN || gameState === STATE.LOSE) {
      updateAnimations(deltaTime);
      drawBackground();
      drawTopBar();
      drawBoard();
      drawBottomBar();
      drawLinkPath();
      drawEndScreen(gameState === STATE.WIN);
    }
  }

  function gameLoop(currentTime) {
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    if (gameState === STATE.PLAYING) {
      timeLeft -= deltaTime;
      if (timeLeft <= 0) {
        timeLeft = 0;
        gameState = STATE.LOSE;
      }
    }

    render(deltaTime);

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(gameLoop);
    } else if (typeof tt !== 'undefined') {
      setTimeout(function () {
        gameLoop(Date.now());
      }, 16);
    }
  }

  // ========= 初始化 Canvas =========
  function initCanvas() {
    if (typeof tt !== 'undefined' && tt.createCanvas) {
      canvas = tt.createCanvas();
      const sysInfo = tt.getSystemInfoSync();
      canvasWidth = sysInfo.windowWidth;
      canvasHeight = sysInfo.windowHeight;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      ctx = canvas.getContext('2d');

      tt.onTouchStart(function (res) {
        if (res && res.touches && res.touches.length > 0) {
          handleInput(res.touches[0].clientX, res.touches[0].clientY);
        }
      });

      return true;
    }

    if (typeof document !== 'undefined') {
      canvas = document.getElementById('gameCanvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'gameCanvas';
        document.body.appendChild(canvas);
      }
      canvasWidth = Math.min(window.innerWidth, 480);
      canvasHeight = Math.min(window.innerHeight, 800);
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      ctx = canvas.getContext('2d');

      function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        let px, py;
        if (e.touches && e.touches.length > 0) {
          px = e.touches[0].clientX - rect.left;
          py = e.touches[0].clientY - rect.top;
        } else {
          px = e.clientX - rect.left;
          py = e.clientY - rect.top;
        }
        return { x: px, y: py };
      }

      canvas.addEventListener('click', function (e) {
        const pos = getPos(e);
        handleInput(pos.x, pos.y);
      });
      canvas.addEventListener('touchstart', function (e) {
        e.preventDefault();
        const pos = getPos(e);
        handleInput(pos.x, pos.y);
      });

      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';
      canvas.style.background = '#1a1a2e';
      canvas.style.touchAction = 'none';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.background = '#1a1a2e';
      document.body.style.minHeight = '100vh';
      document.body.style.display = 'flex';
      document.body.style.justifyContent = 'center';
      document.body.style.alignItems = 'center';

      return true;
    }

    return false;
  }

  function init() {
    if (!initCanvas()) {
      console.error('无法初始化 Canvas');
      return;
    }
    lastTime = Date.now();
    gameLoop(lastTime);
  }

  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
