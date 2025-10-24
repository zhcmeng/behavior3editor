import _useKeyPress, { KeyFilter, KeyType, Options, Target } from "ahooks/lib/useKeyPress";
import { Key } from "ts-key-enum";

export const isMacos = process.platform === "darwin";

let forceTarget: HTMLElement | undefined;

const hotkey = (key: string) => {
  if (key.indexOf("ctrl") >= 0 && isMacos) {
    key = key.replace("ctrl", Key.Meta);
  }
  return key.toLowerCase();
};

export const useKeyPress = (
  keyFilter: KeyFilter,
  target: Target,
  eventHandler: (event: KeyboardEvent, key: KeyType) => void,
  option?: Options
) => {
  option = option || {};
  option.target = target;
  option.exactMatch = true;
  return _useKeyPress(keyFilter, (e, key) => !e.repeat && eventHandler(e, key), option);
};

export const Hotkey = {
  Backspace: Key.Backspace,
  Build: hotkey("ctrl.b"),
  CloseEditor: hotkey("ctrl.w"),
  CloseAllOtherEditors: hotkey("ctrl.shift.w"),
  Copy: hotkey("ctrl.c"),
  Cut: hotkey("ctrl.x"),
  Delete: Key.Delete,
  Duplicate: hotkey("ctrl.d"),
  Enter: Key.Enter,
  Escape: Key.Escape,
  F2: Key.F2,
  Insert: Key.Insert,
  JumpNode: hotkey("ctrl.g"),
  MacDelete: isMacos ? hotkey("ctrl.backspace") : "",
  Paste: hotkey("ctrl.v"),
  Redo: isMacos ? hotkey("shift.ctrl.z") : hotkey("ctrl.y"),
  Replace: hotkey("shift.ctrl.v"),
  Save: hotkey("ctrl.s"),
  SearchTree: hotkey("ctrl.p"),
  SearchNode: hotkey("ctrl.f"),
  SelectAll: hotkey("ctrl.a"),
  Undo: hotkey("ctrl.z"),
};

export const setInputFocus = (target: HTMLElement) => {
  forceTarget = target;
};

export const sendInputEvent = (key: string) => {
  // 简化实现：直接聚焦目标元素
  // 原来的实现依赖 @electron/remote，现在改为更简单的方式
  if (forceTarget) {
    forceTarget.focus();
    
    // 创建并分发键盘事件
    const event = new KeyboardEvent('keydown', {
      key: key,
      bubbles: true,
      cancelable: true
    });
    forceTarget.dispatchEvent(event);
    
    const upEvent = new KeyboardEvent('keyup', {
      key: key,
      bubbles: true,
      cancelable: true
    });
    forceTarget.dispatchEvent(upEvent);
  }
};
