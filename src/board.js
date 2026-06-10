// 连连看游戏棋盘核心逻辑
// 包括棋盘生成、配对检查、路径检测算法

const Board = (function () {
  // 图标的颜色/图案定义（使用颜色区分不同的图案类型）
  const ICON_TYPES = [
    { color: '#FF6B6B', emoji: '★' },
    { color: '#4ECDC4', emoji: '●' },
    { color: '#FFE66D', emoji: '▲' },
    { color: '#95E1D3', emoji: '◆' },
    { color: '#F38181', emoji: '■' },
    { color: '#AA96DA', emoji: '♥' },
    { color: '#FCBAD3', emoji: '♠' },
    { color: '#A8D8EA', emoji: '♣' },
    { color: '#FFD3B6', emoji: '♦' },
    { color: '#B5EAD7', emoji: '✿' },
    { color: '#C7CEEA', emoji: '☼' },
    { color: '#FFDAC1', emoji: '☾' }
  ];

  function createBoard(rows, cols, typeCount) {
    // rows 和 cols 必须都是偶数，保证每种图案都有偶数个
    const totalCells = rows * cols;
    if (totalCells % 2 !== 0) {
      throw new Error('棋盘总格子数必须是偶数');
    }

    // 生成成对的图案索引
    const pairs = [];
    const pairsNeeded = totalCells / 2;
    for (let i = 0; i < pairsNeeded; i++) {
      const typeIdx = i % typeCount;
      pairs.push(typeIdx, typeIdx);
    }

    // Fisher-Yates 洗牌算法
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }

    // 构建二维棋盘
    const board = [];
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      board[r] = [];
      for (let c = 0; c < cols; c++) {
        board[r][c] = {
          type: pairs[idx],
          removed: false,
          row: r,
          col: c
        };
        idx++;
      }
    }

    return board;
  }

  // 检查两个格子是否匹配（类型相同且都未被消除）
  function canMatch(board, cell1, cell2) {
    if (!cell1 || !cell2) return false;
    if (cell1.row === cell2.row && cell1.col === cell2.col) return false;
    if (cell1.removed || cell2.removed) return false;
    if (board[cell1.row][cell1.col].type !== board[cell2.row][cell2.col].type) return false;
    return true;
  }

  // 核心路径检测：两个格子是否可以用不超过两个拐点的线连接
  function findPath(board, cell1, cell2) {
    const rows = board.length;
    const cols = board[0].length;

    // 判断某个位置是否为空（可通行）
    function isEmpty(r, c) {
      if (r < -1 || r > rows || c < -1 || c > cols) return false;
      // 边界外的虚拟格子视为可通行（用于边缘连线）
      if (r === -1 || r === rows || c === -1 || c === cols) return true;
      // 起点和终点视为可通行
      if ((r === cell1.row && c === cell1.col) || (r === cell2.row && c === cell2.col)) return true;
      return board[r][c].removed;
    }

    // 直线连接（0 个拐点）
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

    // 0 个拐点：直接直线
    if (straightLine(cell1.row, cell1.col, cell2.row, cell2.col)) {
      return [{ row: cell1.row, col: cell1.col }, { row: cell2.row, col: cell2.col }];
    }

    // 1 个拐点：尝试两个可能的拐点 (r1, c2) 和 (r2, c1)
    const corners1 = [
      { row: cell1.row, col: cell2.col },
      { row: cell2.row, col: cell1.col }
    ];
    for (const corner of corners1) {
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

    // 2 个拐点：沿水平和垂直方向扫描
    // 水平扫描
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

    // 垂直扫描
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

    return null; // 没有找到有效路径
  }

  // 检查棋盘上是否还存在可匹配的一对
  function hasAnyMatch(board) {
    const rows = board.length;
    const cols = board[0].length;
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
          if (findPath(board, c1, c2)) {
            return { cell1: c1, cell2: c2 };
          }
        }
      }
    }
    return null;
  }

  // 检查棋盘是否全部消除
  function isCleared(board) {
    const rows = board.length;
    const cols = board[0].length;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!board[r][c].removed) return false;
      }
    }
    return true;
  }

  // 提示功能：找到一对可匹配的格子
  function findHint(board) {
    return hasAnyMatch(board);
  }

  // 重排功能：将剩余图标随机重新分配位置
  function shuffle(board) {
    const rows = board.length;
    const cols = board[0].length;
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

    // 洗牌
    for (let i = activeTypes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [activeTypes[i], activeTypes[j]] = [activeTypes[j], activeTypes[i]];
    }

    // 重新分配
    for (let i = 0; i < activePositions.length; i++) {
      const pos = activePositions[i];
      board[pos.row][pos.col].type = activeTypes[i];
    }

    // 确保重排后有解
    let attempts = 0;
    while (!hasAnyMatch(board) && attempts < 50) {
      for (let i = activeTypes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [activeTypes[i], activeTypes[j]] = [activeTypes[j], activeTypes[i]];
      }
      for (let i = 0; i < activePositions.length; i++) {
        const pos = activePositions[i];
        board[pos.row][pos.col].type = activeTypes[i];
      }
      attempts++;
    }

    return board;
  }

  return {
    ICON_TYPES,
    createBoard,
    canMatch,
    findPath,
    hasAnyMatch,
    isCleared,
    findHint,
    shuffle
  };
})();

// 模块导出（兼容小游戏环境和浏览器）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Board;
} else if (typeof window !== 'undefined') {
  window.Board = Board;
}
