/**
 * نظام تسجيل العمليات لتتبع سير العمل
 */

export class ProcessingLogger {
  constructor(manuscriptId = 'unknown') {
    this.manuscriptId = manuscriptId;
    this.logs = [];
    this.startTime = Date.now();
  }

  log(stage, status, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      elapsed: Date.now() - this.startTime,
      stage,
      status, // 'started', 'progress', 'completed', 'error'
      details,
      manuscriptId: this.manuscriptId
    };
    
    this.logs.push(entry);
    
    // طباعة في وضع التطوير
    const isDev = import.meta.env?.MODE === 'development';
    if (isDev) {
      console.log(`[${entry.timestamp}] [${stage}] ${status}`, details);
    }
    
    return entry;
  }

  start(stage, details) {
    return this.log(stage, 'started', details);
  }

  progress(stage, details) {
    return this.log(stage, 'progress', details);
  }

  complete(stage, details) {
    return this.log(stage, 'completed', details);
  }

  error(stage, error) {
    return this.log(stage, 'error', {
      error: error.message,
      stack: error.stack
    });
  }

  getSummary() {
    const totalTime = Date.now() - this.startTime;
    const stages = [...new Set(this.logs.map(l => l.stage))];
    const errors = this.logs.filter(l => l.status === 'error');
    
    return {
      manuscriptId: this.manuscriptId,
      totalTime,
      totalStages: stages.length,
      completedStages: stages.filter(stage => 
        this.logs.some(l => l.stage === stage && l.status === 'completed')
      ).length,
      errors: errors.length,
      logs: this.logs
    };
  }

  export() {
    return {
      summary: this.getSummary(),
      fullLogs: this.logs
    };
  }
}

/**
 * تنسيق الوقت المنقضي
 */
export function formatElapsed(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}