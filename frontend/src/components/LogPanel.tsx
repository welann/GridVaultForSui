"use client"

import { useState, useEffect } from "react"
import { useBotApi, type LogEntry } from "@/hooks/useBotApi"

export function LogPanel() {
  const api = useBotApi()
  const [logs, setLogs] = useState<LogEntry[]>([])

  const loadLogs = async () => {
    const data = await api.fetchLogs(20)
    setLogs(data)
  }

  // 定时刷新
  useEffect(() => {
    loadLogs()
    const interval = setInterval(loadLogs, 2000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'INFO': return '📘'
      case 'WARN': return '⚠️'
      case 'ERROR': return '❌'
      default: return '📝'
    }
  }

  const getLevelClass = (level: string) => {
    switch (level) {
      case 'INFO': return 'level-info'
      case 'WARN': return 'level-warn'
      case 'ERROR': return 'level-error'
      default: return 'level-info'
    }
  }

  const parseMetadata = (metadataStr?: string) => {
    if (!metadataStr) return null
    try {
      return JSON.parse(metadataStr)
    } catch {
      return null
    }
  }

  return (
    <div className="log-panel">
      <div className="card">
        <div className="header">
          <h2>📋 运行日志</h2>
          <div className="header-actions">
            <button onClick={loadLogs} className="btn btn-secondary">
              刷新
            </button>
          </div>
        </div>

        <div className="logs-container">
          {logs.length === 0 ? (
            <div className="empty">暂无日志</div>
          ) : (
            <div className="logs-list">
              {logs.map((log) => {
                const metadata = parseMetadata(log.metadata)
                return (
                  <div key={log.id} className={`log-item ${getLevelClass(log.level)}`}>
                    <div className="log-header">
                      <span className="log-time">{formatTime(log.timestamp)}</span>
                      <span className="log-level">
                        {getLevelIcon(log.level)} {log.level}
                      </span>
                    </div>
                    <div className="log-message">{log.message}</div>
                    {metadata && (
                      <div className="log-metadata">
                        {metadata.price && (
                          <span className="meta-tag price">
                            💰 价格: {metadata.price}
                          </span>
                        )}
                        {metadata.action && (
                          <span className={`meta-tag action ${metadata.action}`}>
                            {metadata.action === 'SELL' ? '📉 卖出' : 
                             metadata.action === 'BUY' ? '📈 买入' : '➡️ ' + metadata.action}
                          </span>
                        )}
                        {metadata.amountIn && (
                          <span className="meta-tag">
                            输入: {metadata.amountIn}
                          </span>
                        )}
                        {metadata.estimatedOut && (
                          <span className="meta-tag">
                            预估输出: {metadata.estimatedOut}
                          </span>
                        )}
                        {metadata.band !== undefined && (
                          <span className="meta-tag">
                            档位: {metadata.band}
                          </span>
                        )}
                        {metadata.txDigest && (
                          <span className="meta-tag tx" title={metadata.txDigest}>
                            🔗 {metadata.txDigest.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .log-panel {
          margin-top: 24px;
        }
        .card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        h2 {
          font-size: 20px;
          font-weight: 600;
        }
        .btn {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          border: none;
          cursor: pointer;
        }
        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }
        .btn:hover {
          opacity: 0.8;
        }
        .logs-container {
          max-height: 400px;
          overflow-y: auto;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #fafafa;
        }
        .empty {
          text-align: center;
          padding: 40px;
          color: #666;
        }
        .logs-list {
          padding: 8px;
        }
        .log-item {
          padding: 10px 12px;
          border-radius: 6px;
          margin-bottom: 6px;
          font-size: 13px;
          background: white;
          border-left: 3px solid transparent;
        }
        .log-item:last-child {
          margin-bottom: 0;
        }
        .level-info {
          border-left-color: #3b82f6;
          background: #eff6ff;
        }
        .level-warn {
          border-left-color: #f59e0b;
          background: #fffbeb;
        }
        .level-error {
          border-left-color: #ef4444;
          background: #fef2f2;
        }
        .log-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 4px;
        }
        .log-time {
          font-family: monospace;
          font-size: 12px;
          color: #6b7280;
        }
        .log-level {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .level-info .log-level {
          color: #2563eb;
        }
        .level-warn .log-level {
          color: #d97706;
        }
        .level-error .log-level {
          color: #dc2626;
        }
        .log-message {
          color: #1f2937;
          line-height: 1.5;
          word-break: break-word;
        }
        .log-metadata {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 6px;
        }
        .meta-tag {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          background: #e5e7eb;
          color: #374151;
        }
        .meta-tag.price {
          background: #dbeafe;
          color: #1e40af;
        }
        .meta-tag.action {
          background: #e0e7ff;
          color: #3730a3;
        }
        .meta-tag.action.SELL {
          background: #fef3c7;
          color: #92400e;
        }
        .meta-tag.action.BUY {
          background: #d1fae5;
          color: #065f46;
        }
        .meta-tag.tx {
          background: #f3e8ff;
          color: #6b21a8;
          cursor: pointer;
        }
        .meta-tag.tx:hover {
          background: #e9d5ff;
        }
      `}</style>
    </div>
  )
}
