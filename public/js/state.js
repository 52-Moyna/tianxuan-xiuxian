/**
 * state.js —— 运行时状态容器 + 事件总线
 * ============================================================
 * 职责：
 *   - 持有当前游戏状态 GameState（唯一数据源）
 *   - 提供极简事件总线，供「玩法系统」与「界面层」解耦通信
 *     （玩法逻辑只改状态并发事件，UI 只监听事件并渲染）
 *
 * 【扩展点 · 联机版】
 *   - 可在 emit() 中追加「状态同步到服务器」的分支
 *   - 可在 bus 上挂载「服务器推送」事件源（WebSocket 消息 -> bus.emit）
 */

/* ---------------- 事件总线 ---------------- */
const listeners = {};

export const bus = {
  /** 订阅事件。event 支持 '*' 通配（监听全部） */
  on(event, fn) {
    (listeners[event] = listeners[event] || []).push(fn);
  },
  /** 发布事件 */
  emit(event, payload) {
    (listeners[event] || []).forEach((fn) => fn(payload));
    (listeners['*'] || []).forEach((fn) => fn({ event, payload }));
  },
};

/* 常用事件名约定：
 *   'state:changed'   状态已变化（UI 全量/局部刷新）
 *   'log'             追加一条叙事日志  payload: {text, kind}
 *   'toast'           轻提示          payload: {text, kind}
 *   'modal:event'     弹出事件窗口    payload: 事件对象
 *   'modal:battle'    弹出战斗窗口
 *   'modal:breakthrough' 弹出渡劫窗口
 *   'screen:switch'   切换界面
 */

/* ---------------- 全局状态 ---------------- */
export const GameState = {
  data: null, // 由 main.js 在开局/读档后注入

  get player() { return this.data?.player; },
  get world() { return this.data?.world; },

  /** 替换整个状态并广播 */
  setData(data) {
    this.data = data;
    bus.emit('state:changed');
  },

  /** 状态局部更新后调用，通知 UI 刷新 */
  touch() {
    bus.emit('state:changed');
  },
};

/* ---------------- 通用随机工具（供各系统使用） ---------------- */
export const Rng = {
  int(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
  /** 区间随机浮点 [min, max) */
  float(min, max) { return min + Math.random() * (max - min); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  /** 按 weight 字段加权抽取 */
  weighted(arr) {
    const total = arr.reduce((s, a) => s + (a.weight || 1), 0);
    let r = Math.random() * total;
    for (const a of arr) {
      r -= (a.weight || 1);
      if (r <= 0) return a;
    }
    return arr[arr.length - 1];
  },
  /** 概率判定，p 为 0~1 */
  chance(p) { return Math.random() < p; },
  /** 生成存档码：XXXX-XXXX */
  saveCode(chars) {
    const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${seg()}-${seg()}`;
  },
};
