/**
 * 文件：log.ts
 * 用途：直接写入调试日志文件（替换 electron-log）
 * 描述：为渲染进程提供统一的日志写入 API
 */

import { VarDecl } from "./b3type";
import { useSetting } from "../contexts/setting-context";

// 动态获取 Node 模块与主进程 app
// 注意：本项目启用了 nodeIntegration=true，因此渲染进程可以使用 require
// 且通过 @electron/remote 访问主进程的 app 路径
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require('@electron/remote');

export enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error",
}

function formatTimestamp(date: Date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const ii = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${ii}:${ss}`;
}

function ensureLogFile(): string {
    const dir = path.join(app.getPath('userData'), 'logs');
    const file = path.join(dir, 'debug.log');
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, '');
        }
    } catch (e) {
        console.error('ensureLogFile failed:', e);
    }
    return file;
}

export const getDebugLogFilePath = (): string => {
    try {
        return ensureLogFile();
    } catch (e) {
        console.warn('getDebugLogFilePath failed:', e);
        return path.join(app.getPath('userData'), 'logs', 'debug.log');
    }
};

export const clearDebugLog = (): boolean => {
    try {
        const file = ensureLogFile();
        fs.writeFileSync(file, '');
        return true;
    } catch (e) {
        console.error('clearDebugLog failed:', e);
        return false;
    }
};

export const getDebugLogSize = (): number => {
    try {
        const file = ensureLogFile();
        return fs.existsSync(file) ? fs.statSync(file).size : 0;
    } catch (e) {
        console.error('getDebugLogSize failed:', e);
        return 0;
    }
};

function append(level: LogLevel, text: string) {
    try {
        const file = ensureLogFile();
        const stamp = formatTimestamp(new Date());
        fs.appendFileSync(file, `[${stamp}] [renderer] [${level}] ${text}\n`);
    } catch (e) {
        console.error('append log failed:', e);
    }
}

// 获取日志级别：优先读取菜单设置（Store）；否则 localStorage；开发模式默认 DEBUG；生产默认 INFO
function getLogLevel(): LogLevel {
  try {
    // 1) 菜单设置（Zustand Store）
    const storeLevel = useSetting.getState().getLogLevel?.();
    if (storeLevel) return storeLevel as unknown as LogLevel;

    // 2) 用户设置优先（localStorage）
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem('logLevel') || window.localStorage.getItem('b3editor.logLevel');
      if (raw === LogLevel.DEBUG || raw === LogLevel.INFO || raw === LogLevel.WARN || raw === LogLevel.ERROR) {
        return raw as LogLevel;
      }
    }
    // 3) 开发环境默认 DEBUG（Vite 提供 import.meta.env.DEV）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (import.meta as any)?.env;
    if (env?.DEV) return LogLevel.DEBUG;
  } catch (error) {
    console.warn('Failed to get log level from store/localStorage/env:', error);
  }
  // 4) 生产环境默认 INFO
  return LogLevel.INFO;
}

export const logMessage = (context: string, message: string, data?: any, level: LogLevel = LogLevel.DEBUG) => {
    const fullMessage = context ? `${context} ${message}` : message;
    let logContent: string;
    if (data !== undefined) {
        const dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
        logContent = `${fullMessage}\n${dataStr}`;
    } else {
        logContent = fullMessage;
    }

    // 控制台输出便于开发调试
    switch (level) {
        case LogLevel.DEBUG:
            console.debug(logContent);
            break;
        case LogLevel.INFO:
            console.info(logContent);
            break;
        case LogLevel.WARN:
            console.warn(logContent);
            break;
        case LogLevel.ERROR:
            console.error(logContent);
            break;
    }

    // 直接写入日志文件
    const currentLevel = getLogLevel();
    const priority = {
        [LogLevel.DEBUG]: 0,
        [LogLevel.INFO]: 1,
        [LogLevel.WARN]: 2,
        [LogLevel.ERROR]: 3,
    };
    if (priority[level] >= priority[currentLevel]) {
        append(level, logContent);
    }
};

export { logMessage as log };

export const logDebug = (context: string, message: string, data?: any) => {
    logMessage(context, message, data, LogLevel.DEBUG);
};
export const logInfo = (context: string, message: string, data?: any) => {
    logMessage(context, message, data, LogLevel.INFO);
};
export const logWarn = (context: string, message: string, data?: any) => {
    logMessage(context, message, data, LogLevel.WARN);
};
export const logError = (context: string, message: string, data?: any) => {
    logMessage(context, message, data, LogLevel.ERROR);
};

export const debugVarCheck = (context: string, varName: string, varValue: any, varDecl?: VarDecl) => {
    if (getLogLevel() === LogLevel.DEBUG) {
        const message = `Variable check: ${varName}`;
        const data = {
            value: varValue,
            type: typeof varValue,
            declaration: varDecl,
        };
        logDebug(context, message, data);
    }
};