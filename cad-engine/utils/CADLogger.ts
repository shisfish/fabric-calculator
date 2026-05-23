/**
 * CAD Logger - 工业级统一日志管理器
 * 
 * 设计原则：
 * 1. 关注点分离：日志输出到 stderr，API响应输出到 stdout
 * 2. 日志级别控制：通过环境变量 CAD_LOG_LEVEL 控制
 * 3. 标准化格式：[时间戳] [级别] [模块] 消息
 * 4. 零污染：绝不向 stdout 输出任何非JSON内容
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'off';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  off: 4
};

class CADLogger {
  private level: LogLevel;
  private module: string;

  constructor(module: string = 'CAD') {
    this.module = module;
    
    // 从环境变量读取日志级别，默认为 info
    const envLevel = (process.env.CAD_LOG_LEVEL || 'info').toLowerCase();
    this.level = Object.keys(LOG_LEVEL_PRIORITY).includes(envLevel) 
      ? envLevel as LogLevel 
      : 'info';
  }

  private shouldLog(messageLevel: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[messageLevel] >= LOG_LEVEL_PRIORITY[this.level];
  }

  private formatMessage(level: LogLevel, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    return `[${timestamp}] [${level.toUpperCase()}] [${this.module}] ${message}`;
  }

  /**
   * 调试信息 - 用于开发调试，详细的技术细节
   */
  debug(...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.error(this.formatMessage('debug', ...args));
    }
  }

  /**
   * 信息 - 一般运行状态，关键节点
   */
  info(...args: any[]): void {
    if (this.shouldLog('info')) {
      console.error(this.formatMessage('info', ...args));
    }
  }

  /**
   * 警告 - 潜在问题，但不影响功能
   */
  warn(...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.error(this.formatMessage('warn', ...args));
    }
  }

  /**
   * 错误 - 必须关注的问题，始终输出
   */
  error(...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', ...args));
    }
  }

  /**
   * 获取当前日志级别
   */
  getLevel(): LogLevel {
    return this.level;
  }
}

// 导出工厂函数，方便不同模块创建自己的logger实例
export function createLogger(module: string): CADLogger {
  return new CADLogger(module);
}

// 导出默认实例（用于cad_runner.ts主入口）
export const logger = new CADLogger('CAD-RUNNER');

export { CADLogger, LogLevel };
