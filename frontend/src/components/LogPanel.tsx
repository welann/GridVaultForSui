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

  // Auto refresh
  useEffect(() => {
    loadLogs()
    const interval = setInterval(loadLogs, 2000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
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
          <h2>📋 Logs</h2>
          <div className="header-actions">
            <button onClick={loadLogs} className="btn btn-secondary">
              Refresh
            </button>
          </div>
        </div>

        <div className="logs-container">
          {logs.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📝</div>
              <p>No logs yet</p>
            </div>
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
                            💰 Price: {metadata.price}
                          </span>
                        )}
                        {metadata.action && (
                          <span className={`meta-tag action ${metadata.action}`}>
                            {metadata.action === 'SELL' ? '📉 Sell' : 
                             metadata.action === 'BUY' ? '📈 Buy' : '➡️ ' + metadata.action}
                          </span>
                        )}
                        {metadata.amountIn && (
                          <span className="meta-tag">
                            In: {metadata.amountIn}
                          </span>
                        )}
                        {metadata.estimatedOut && (
                          <span className="meta-tag">
                            Est: {metadata.estimatedOut}
                          </span>
                        )}
                        {metadata.band !== undefined && (
                          <span className="meta-tag">
                            Band: {metadata.band}
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
          background: rgba(23, 23, 30, 0.8);
          border: 1px solid rgba(99, 102, 241, 0.15);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          color: #e5e7eb;
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
          color: #e5e7eb;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .btn {
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-secondary {
          background: rgba(99, 102, 241, 0.1);
          color: #a5b4fc;
          border: 1px solid rgba(99, 102, 241, 0.2);
        }
        .btn:hover {
          background: rgba(99, 102, 241, 0.2);
        }
        .logs-container {
          max-height: 400px;
          overflow-y: auto;
          border: 1px solid rgba(99, 102, 241, 0.15);
          border-radius: 12px;
          background: rgba(17, 17, 24, 0.6);
        }
        .empty {
          text-align: center;
          padding: 48px 24px;
          color: #6b7280;
        }
        .empty-icon {
          font-size: 40px;
          margin-bottom: 12px;
          opacity: 0.6;
        }
        .empty p {
          font-size: 14px;
        }
        .logs-list {
          padding: 8px;
        }
        .log-item {
          padding: 10px 12px;
          border-radius: 8px;
          margin-bottom: 6px;
          font-size: 13px;
          background: rgba(23, 23, 30, 0.8);
          border-left: 3px solid transparent;
        }
        .log-item:last-child {
          margin-bottom: 0;
        }
        .level-info {
          border-left-color: #6366f1;
        }
        .level-warn {
          border-left-color: #f59e0b;
        }
        .level-error {
          border-left-color: #ef4444;
        }
        .log-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 4px;
        }
        .log-time {
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
          font-size: 11px;
          color: #6b7280;
        }
        .log-level {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .level-info .log-level {
          color: #818cf8;
        }
        .level-warn .log-level {
          color: #fbbf24;
        }
        .level-error .log-level {
          color: #f87171;
        }
        .log-message {
          color: #e5e7eb;
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
          font-size: 10px;
          font-weight: 500;
          background: rgba(99, 102, 241, 0.1);
          color: #a5b4fc;
        }
        .meta-tag.price {
          background: rgba(59, 130, 246, 0.1);
          color: #60a5fa;
        }
        .meta-tag.action {
          background: rgba(99, 102, 241, 0.1);
          color: #a5b4fc;
        }
        .meta-tag.action.SELL {
          background: rgba(251, 191, 36, 0.1);
          color: #fbbf24;
        }
        .meta-tag.action.BUY {
          background: rgba(34, 197, 94, 0.1);
          color: #4ade80;
        }
        .meta-tag.tx {
          background: rgba(168, 85, 247, 0.1);
          color: #c084fc;
          cursor: pointer;
        }
        .meta-tag.tx:hover {
          background: rgba(168, 85, 247, 0.2);
        }
      `}</style>
    </div>
  )
}
