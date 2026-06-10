// Canvas 渲染模块
// 负责棋盘、图标、连线动画、UI 界面的绘制

const Renderer = (function () {

  function createRenderer(ctx, canvasWidth, canvasHeight, config) {
    const renderer = {
      ctx: ctx,
      width: canvasWidth,
      height: canvasHeight,
      config: config,
      linkPath: null,
      linkProgress: 0,
      hintCells: null,
      hintTimer: 0,
      selectedCell: null,
      wrongShake: null,
      wrongShakeTimer: 0,
      cellPulse: {}
    };

    // 根据屏幕尺寸动态计算格子大小
    function recalcLayout(rows, cols) {
      const boardPadding = 20;
      const availableWidth = renderer.width - boardPadding * 2;
      const availableHeight = renderer.height - config.topBarHeight - config.bottomBarHeight - boardPadding * 2;

      const maxCellWidth = availableWidth / cols;
      const maxCellHeight = availableHeight / rows;
      const cellSize = Math.min(maxCellWidth, maxCellHeight, config.cellSize);

      const boardWidth = cellSize * cols;
      const boardHeight = cellSize * rows;
      const offsetX = (renderer.width - boardWidth) / 2;
      const offsetY = config.topBarHeight + boardPadding;

      renderer.cellSize = cellSize;
      renderer.offsetX = offsetX;
      renderer.offsetY = offsetY;
      renderer.rows = rows;
      renderer.cols = cols;
    }
    renderer.recalcLayout = recalcLayout;

    // 获取格子中心像素坐标
    function cellToPixel(row, col) {
      return {
        x: renderer.offsetX + col * renderer.cellSize + renderer.cellSize / 2,
        y: renderer.offsetY + row * renderer.cellSize + renderer.cellSize / 2
      };
    }
    renderer.cellToPixel = cellToPixel;

    // 像素坐标转换为格子坐标
    function pixelToCell(x, y) {
      const col = Math.floor((x - renderer.offsetX) / renderer.cellSize);
      const row = Math.floor((y - renderer.offsetY) / renderer.cellSize);
      if (row >= 0 && row < renderer.rows && col >= 0 && col < renderer.cols) {
        return { row: row, col: col };
      }
      return null;
    }
    renderer.pixelToCell = pixelToCell;

    // 绘制背景
    function drawBackground() {
      const gradient = ctx.createLinearGradient(0, 0, 0, renderer.height);
      gradient.addColorStop(0, '#1a1a2e');
      gradient.addColorStop(1, '#16213e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, renderer.width, renderer.height);

      // 装饰性背景圆点
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      for (let i = 0; i < 40; i++) {
        const x = (i * 73) % renderer.width;
        const y = (i * 137) % renderer.height;
        const r = 2 + (i % 4);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    renderer.drawBackground = drawBackground;

    // 绘制单个格子
    function drawCell(row, col, type, isSelected, isHint) {
      const size = renderer.cellSize;
      const padding = size * 0.08;
      const x = renderer.offsetX + col * size + padding;
      const y = renderer.offsetY + row * size + padding;
      const cellW = size - padding * 2;
      const cellH = size - padding * 2;

      // 计算脉冲/抖动效果
      let offsetX = 0;
      let offsetY = 0;
      let scale = 1;

      const pulseKey = row + ',' + col;
      if (renderer.cellPulse[pulseKey]) {
        const p = renderer.cellPulse[pulseKey];
        scale = 1 + Math.sin(p.phase) * 0.08;
      }

      if (renderer.wrongShake &&
          ((renderer.wrongShake.row1 === row && renderer.wrongShake.col1 === col) ||
           (renderer.wrongShake.row2 === row && renderer.wrongShake.col2 === col))) {
        offsetX = Math.sin(renderer.wrongShakeTimer * 0.5) * 4;
      }

      ctx.save();
      ctx.translate(x + cellW / 2 + offsetX, y + cellH / 2 + offsetY);
      ctx.scale(scale, scale);
      ctx.translate(-(x + cellW / 2), -(y + cellH / 2));

      // 格子阴影
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;

      // 格子背景
      const iconInfo = Board.ICON_TYPES[type];
      const radius = cellW * 0.18;

      roundRect(ctx, x, y, cellW, cellH, radius);
      const bgGradient = ctx.createLinearGradient(x, y, x, y + cellH);
      bgGradient.addColorStop(0, iconInfo.color);
      bgGradient.addColorStop(1, shadeColor(iconInfo.color, -20));
      ctx.fillStyle = bgGradient;
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // 选中边框
      if (isSelected) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        roundRect(ctx, x - 2, y - 2, cellW + 4, cellH + 4, radius);
        ctx.stroke();

        // 选中动画光环
        ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.4 + Math.sin(Date.now() / 200) * 0.2) + ')';
        ctx.lineWidth = 2;
        roundRect(ctx, x - 6, y - 6, cellW + 12, cellH + 12, radius + 4);
        ctx.stroke();
      }

      // 提示闪烁
      if (isHint) {
        ctx.strokeStyle = 'rgba(255, 215, 0, ' + (0.5 + Math.sin(Date.now() / 150) * 0.3) + ')';
        ctx.lineWidth = 4;
        roundRect(ctx, x - 3, y - 3, cellW + 6, cellH + 6, radius);
        ctx.stroke();
      }

      // 图案符号
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold ' + Math.floor(cellW * 0.5) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(iconInfo.emoji, x + cellW / 2, y + cellH / 2);

      // 高光效果
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.ellipse(x + cellW / 2, y + cellH * 0.3, cellW * 0.25, cellH * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 绘制棋盘
    function drawBoard(board) {
      recalcLayout(board.length, board[0].length);

      // 棋盘背景
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      const boardW = renderer.cellSize * renderer.cols;
      const boardH = renderer.cellSize * renderer.rows;
      roundRect(ctx, renderer.offsetX - 10, renderer.offsetY - 10,
                boardW + 20, boardH + 20, 12);
      ctx.fill();

      // 网格线
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let r = 0; r <= renderer.rows; r++) {
        const y = renderer.offsetY + r * renderer.cellSize;
        ctx.beginPath();
        ctx.moveTo(renderer.offsetX, y);
        ctx.lineTo(renderer.offsetX + boardW, y);
        ctx.stroke();
      }
      for (let c = 0; c <= renderer.cols; c++) {
        const x = renderer.offsetX + c * renderer.cellSize;
        ctx.beginPath();
        ctx.moveTo(x, renderer.offsetY);
        ctx.lineTo(x, renderer.offsetY + boardH);
        ctx.stroke();
      }

      // 绘制格子
      for (let r = 0; r < renderer.rows; r++) {
        for (let c = 0; c < renderer.cols; c++) {
          if (!board[r][c].removed) {
            const isSelected = renderer.selectedCell &&
                             renderer.selectedCell.row === r && renderer.selectedCell.col === c;
            const isHint = renderer.hintCells &&
                          ((renderer.hintCells.cell1.row === r && renderer.hintCells.cell1.col === c) ||
                           (renderer.hintCells.cell2.row === r && renderer.hintCells.cell2.col === c));
            drawCell(r, c, board[r][c].type, isSelected, isHint);
          }
        }
      }
    }
    renderer.drawBoard = drawBoard;

    // 绘制连线（匹配成功时的动画线）
    function drawLinkPath() {
      if (!renderer.linkPath) return;

      const points = renderer.linkPath.map(function (p) {
        return cellToPixel(p.row, p.col);
      });

      ctx.strokeStyle = 'rgba(255, 215, 0, ' + (1 - renderer.linkProgress * 0.5) + ')';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 外发光
      ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
      ctx.shadowBlur = 10;

      ctx.beginPath();
      const totalLen = calculatePathLength(points);
      const drawLen = totalLen * renderer.linkProgress;
      let accLen = 0;

      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const segLen = distance(points[i - 1], points[i]);
        if (accLen + segLen <= drawLen) {
          ctx.lineTo(points[i].x, points[i].y);
          accLen += segLen;
        } else {
          const remain = drawLen - accLen;
          const ratio = remain / segLen;
          const interpX = points[i - 1].x + (points[i].x - points[i - 1].x) * ratio;
          const interpY = points[i - 1].y + (points[i].y - points[i - 1].y) * ratio;
          ctx.lineTo(interpX, interpY);
          break;
        }
      }
      ctx.stroke();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
    renderer.drawLinkPath = drawLinkPath;

    // 绘制顶部信息栏
    function drawTopBar(score, level, timeLeft) {
      const barY = 0;
      const barH = config.topBarHeight;

      // 背景
      const bg = ctx.createLinearGradient(0, barY, 0, barH);
      bg.addColorStop(0, 'rgba(30, 30, 60, 0.9)');
      bg.addColorStop(1, 'rgba(30, 30, 60, 0.6)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, barY, renderer.width, barH);

      // 分割线
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(0, barH - 2, renderer.width, 2);

      // 分数
      ctx.fillStyle = '#FFE66D';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('分数', 20, barH / 2);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(score, 70, barH / 2);

      // 关卡
      ctx.textAlign = 'center';
      ctx.fillStyle = '#4ECDC4';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('关卡', renderer.width / 2, barH / 2 - 12);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('第 ' + level + ' 关', renderer.width / 2, barH / 2 + 14);

      // 时间
      ctx.textAlign = 'right';
      ctx.fillStyle = '#FF6B6B';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('时间', renderer.width - 80, barH / 2);
      ctx.fillStyle = timeLeft < 10 ? '#FF6B6B' : '#FFFFFF';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(Math.ceil(timeLeft) + 's', renderer.width - 20, barH / 2);

      // 时间进度条
      if (timeLeft < 20 && Math.floor(timeLeft) !== Math.floor(timeLeft + 0.1)) {
        // 闪烁效果由主循环触发重绘
      }
    }
    renderer.drawTopBar = drawTopBar;

    // 绘制底部按钮栏
    function drawBottomBar(onHint, onShuffle, hintCount, shuffleCount) {
      const barY = renderer.height - config.bottomBarHeight;
      const barH = config.bottomBarHeight;

      // 背景
      const bg = ctx.createLinearGradient(0, barY, 0, renderer.height);
      bg.addColorStop(0, 'rgba(30, 30, 60, 0.6)');
      bg.addColorStop(1, 'rgba(30, 30, 60, 0.9)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, barY, renderer.width, barH);

      // 分割线
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(0, barY, renderer.width, 2);

      const btnW = (renderer.width - 80) / 2;
      const btnH = barH - 20;
      const btnY = barY + 10;

      renderer.hintBtn = { x: 20, y: btnY, w: btnW, h: btnH };
      renderer.shuffleBtn = { x: renderer.width - btnW - 20, y: btnY, w: btnW, h: btnH };

      // 提示按钮
      drawButton(renderer.hintBtn, '提示 (' + hintCount + ')', '#FFE66D');
      // 重排按钮
      drawButton(renderer.shuffleBtn, '重排 (' + shuffleCount + ')', '#4ECDC4');
    }
    renderer.drawBottomBar = drawBottomBar;

    function drawButton(btn, text, color) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;

      const gradient = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, shadeColor(color, -15));
      ctx.fillStyle = gradient;
      roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 12);
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

    // 检查点是否在按钮内
    function checkButtonClick(x, y) {
      if (renderer.hintBtn && x >= renderer.hintBtn.x && x <= renderer.hintBtn.x + renderer.hintBtn.w &&
          y >= renderer.hintBtn.y && y <= renderer.hintBtn.y + renderer.hintBtn.h) {
        return 'hint';
      }
      if (renderer.shuffleBtn && x >= renderer.shuffleBtn.x && x <= renderer.shuffleBtn.x + renderer.shuffleBtn.w &&
          y >= renderer.shuffleBtn.y && y <= renderer.shuffleBtn.y + renderer.shuffleBtn.h) {
        return 'shuffle';
      }
      return null;
    }
    renderer.checkButtonClick = checkButtonClick;

    // 绘制开始界面
    function drawStartScreen() {
      drawBackground();

      // 标题
      ctx.fillStyle = '#FFE66D';
      ctx.font = 'bold 56px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(255, 230, 109, 0.5)';
      ctx.shadowBlur = 20;
      ctx.fillText('连连看', renderer.width / 2, renderer.height * 0.25);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('经典益智游戏', renderer.width / 2, renderer.height * 0.33);

      // 装饰图案
      const emojiSize = 36;
      ctx.font = emojiSize + 'px sans-serif';
      const demoIcons = ['★', '●', '▲', '◆', '■', '♥'];
      const spacing = renderer.width / (demoIcons.length + 1);
      for (let i = 0; i < demoIcons.length; i++) {
        const x = spacing * (i + 1);
        const y = renderer.height * 0.45 + Math.sin((Date.now() / 500) + i) * 8;
        ctx.fillStyle = Board.ICON_TYPES[i].color;
        ctx.fillText(demoIcons[i], x, y);
      }

      // 开始按钮
      const btnW = Math.min(240, renderer.width * 0.6);
      const btnH = 70;
      const btnX = (renderer.width - btnW) / 2;
      const btnY = renderer.height * 0.65;
      renderer.startBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

      ctx.shadowColor = 'rgba(78, 205, 196, 0.5)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 4;
      const gradient = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
      gradient.addColorStop(0, '#4ECDC4');
      gradient.addColorStop(1, '#3BA99E');
      ctx.fillStyle = gradient;
      roundRect(ctx, btnX, btnY, btnW, btnH, 16);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('开始游戏', btnX + btnW / 2, btnY + btnH / 2);

      // 规则提示
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '16px sans-serif';
      ctx.fillText('点击两个相同图案，连线不超过3段即可消除', renderer.width / 2, renderer.height * 0.82);
      ctx.fillText('消除所有图案即为过关', renderer.width / 2, renderer.height * 0.87);
    }
    renderer.drawStartScreen = drawStartScreen;

    // 绘制结束界面
    function drawEndScreen(isWin, score, level) {
      // 半透明遮罩
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, 0, renderer.width, renderer.height);

      const titleColor = isWin ? '#FFE66D' : '#FF6B6B';
      const titleText = isWin ? '恭喜过关！' : '时间到！';

      ctx.fillStyle = titleColor;
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = isWin ? 'rgba(255, 230, 109, 0.5)' : 'rgba(255, 107, 107, 0.5)';
      ctx.shadowBlur = 15;
      ctx.fillText(titleText, renderer.width / 2, renderer.height * 0.3);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '24px sans-serif';
      ctx.fillText('第 ' + level + ' 关', renderer.width / 2, renderer.height * 0.4);
      ctx.fillText('总分: ' + score, renderer.width / 2, renderer.height * 0.47);

      if (isWin) {
        ctx.fillStyle = '#4ECDC4';
        ctx.font = '20px sans-serif';
        ctx.fillText('继续挑战下一关吧！', renderer.width / 2, renderer.height * 0.54);
      } else {
        ctx.fillStyle = '#AA96DA';
        ctx.font = '20px sans-serif';
        ctx.fillText('别气馁，再来一次！', renderer.width / 2, renderer.height * 0.54);
      }

      // 再玩一次按钮
      const btnW = Math.min(240, renderer.width * 0.6);
      const btnH = 70;
      const btnX = (renderer.width - btnW) / 2;
      const btnY = renderer.height * 0.68;
      renderer.restartBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

      ctx.shadowColor = 'rgba(78, 205, 196, 0.5)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 4;
      const gradient = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
      gradient.addColorStop(0, '#4ECDC4');
      gradient.addColorStop(1, '#3BA99E');
      ctx.fillStyle = gradient;
      roundRect(ctx, btnX, btnY, btnW, btnH, 16);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isWin ? '下一关' : '再来一次', btnX + btnW / 2, btnY + btnH / 2);
    }
    renderer.drawEndScreen = drawEndScreen;

    function checkStartScreenClick(x, y) {
      if (renderer.startBtn && x >= renderer.startBtn.x && x <= renderer.startBtn.x + renderer.startBtn.w &&
          y >= renderer.startBtn.y && y <= renderer.startBtn.y + renderer.startBtn.h) {
        return true;
      }
      return false;
    }
    renderer.checkStartScreenClick = checkStartScreenClick;

    function checkEndScreenClick(x, y) {
      if (renderer.restartBtn && x >= renderer.restartBtn.x && x <= renderer.restartBtn.x + renderer.restartBtn.w &&
          y >= renderer.restartBtn.y && y <= renderer.restartBtn.y + renderer.restartBtn.h) {
        return true;
      }
      return false;
    }
    renderer.checkEndScreenClick = checkEndScreenClick;

    // 更新动画状态
    function update(deltaTime) {
      if (renderer.linkPath) {
        renderer.linkProgress += deltaTime * 2;
        if (renderer.linkProgress >= 1.5) {
          renderer.linkPath = null;
          renderer.linkProgress = 0;
        }
      }

      if (renderer.hintCells) {
        renderer.hintTimer += deltaTime;
        if (renderer.hintTimer > 3) {
          renderer.hintCells = null;
          renderer.hintTimer = 0;
        }
      }

      if (renderer.wrongShake) {
        renderer.wrongShakeTimer += deltaTime * 30;
        if (renderer.wrongShakeTimer > 20) {
          renderer.wrongShake = null;
          renderer.wrongShakeTimer = 0;
        }
      }

      // 脉冲动画
      for (const key in renderer.cellPulse) {
        renderer.cellPulse[key].phase += deltaTime * 8;
        if (renderer.cellPulse[key].phase > Math.PI * 3) {
          delete renderer.cellPulse[key];
        }
      }
    }
    renderer.update = update;

    // 设置匹配连线动画
    function setLinkPath(path) {
      renderer.linkPath = path;
      renderer.linkProgress = 0;
    }
    renderer.setLinkPath = setLinkPath;

    // 设置提示高亮
    function setHint(cells) {
      renderer.hintCells = cells;
      renderer.hintTimer = 0;
    }
    renderer.setHint = setHint;

    // 设置选中格子
    function setSelected(cell) {
      renderer.selectedCell = cell;
    }
    renderer.setSelected = setSelected;

    // 设置错误抖动
    function setWrongShake(cell1, cell2) {
      renderer.wrongShake = { row1: cell1.row, col1: cell1.col, row2: cell2.row, col2: cell2.col };
      renderer.wrongShakeTimer = 0;
    }
    renderer.setWrongShake = setWrongShake;

    // 设置格子脉冲
    function pulseCell(row, col) {
      renderer.cellPulse[row + ',' + col] = { phase: 0 };
    }
    renderer.pulseCell = pulseCell;

    return renderer;
  }

  // 工具函数
  function roundRect(ctx, x, y, w, h, r) {
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
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)).toString(16).slice(1);
  }

  function distance(p1, p2) {
    return Math.sqrt((p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y));
  }

  function calculatePathLength(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += distance(points[i - 1], points[i]);
    }
    return total;
  }

  return {
    createRenderer: createRenderer
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Renderer;
} else if (typeof window !== 'undefined') {
  window.Renderer = Renderer;
}
