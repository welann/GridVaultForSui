"use client"

import { useState, useEffect, useCallback } from "react"
import { useBotApi, type BotStatus, type GridConfig } from "@/hooks/useBotApi"
import { formatAmount, formatTimestamp, formatPrice } from "@/lib/utils"

export function BotControl() {
  const api = useBotApi()
  const [status, setStatus] = useState<BotStatus | null>(null)
  const [config, setConfig] = useState<GridConfig | null>(null)
  const [editingConfig, setEditingConfig] = useState<Partial<GridConfig>>({})
  const [showEdit, setShowEdit] = useState(false)

  // 刷新状态
  const refresh = useCallback(async () => {
    const [s, c] = await Promise.all([api.fetchStatus(), api.fetchConfig()])
    if (s) setStatus(s)
    if (c) {
      setConfig(c)
      if (!showEdit) {
        setEditingConfig(c)
      }
    }
  }, [api, showEdit])

  // 定时刷新
  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleControl = async (command: "start" | "stop") => {
    const success = await api.controlBot(command)
    if (success) {
      await refresh()
    }
  }

  const handleSaveConfig = async () => {
    const payload = sanitizeConfig(editingConfig)
    const success = await api.updateConfig(payload)
    if (success) {
      setShowEdit(false)
      await refresh()
    }
  }

  const toggleEdit = () => {
    if (!showEdit && config) {
      setEditingConfig(config)
    }
    setShowEdit(!showEdit)
  }

  const parseNumber = (value: string, type: "int" | "float") => {
    if (value.trim() === "") return undefined
    const parsed = type === "int" ? parseInt(value, 10) : parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  const sanitizeConfig = (draft: Partial<GridConfig>): Partial<GridConfig> => {
    const cleaned: Partial<GridConfig> = {}
    if (typeof draft.lowerPrice === "number" && Number.isFinite(draft.lowerPrice)) {
      cleaned.lowerPrice = draft.lowerPrice
    }
    if (typeof draft.upperPrice === "number" && Number.isFinite(draft.upperPrice)) {
      cleaned.upperPrice = draft.upperPrice
    }
    if (typeof draft.levels === "number" && Number.isFinite(draft.levels)) {
      cleaned.levels = draft.levels
    }
    if (typeof draft.amountPerGrid === "number" && Number.isFinite(draft.amountPerGrid)) {
      cleaned.amountPerGrid = draft.amountPerGrid
    }
    if (typeof draft.slippageBps === "number" && Number.isFinite(draft.slippageBps)) {
      cleaned.slippageBps = draft.slippageBps
    }
    return cleaned
  }

  return (
    <div className="bot-control">
      {/* 状态卡片 */}
      <div className="card status-card">
        <div className="status-header">
          <h2>🤖 Bot 状态</h2>
          <span className={`badge ${status?.running ? "running" : "stopped"}`}>
            {status?.running ? "运行中" : "已停止"}
          </span>
        </div>

        {status && (
          <div className="status-grid">
            <div className="status-item">
              <label>Vault ID</label>
              <span>{status.vaultId ? status.vaultId.slice(0, 16) + "..." : "-"}</span>
            </div>
            <div className="status-item">
              <label>SUI 余额</label>
              <span>{formatAmount(status.balances.a)} SUI</span>
            </div>
            <div className="status-item">
              <label>USDC 余额</label>
              <span>{formatAmount(status.balances.b, 6)} USDC</span>
            </div>
            <div className="status-item">
              <label>当前档位</label>
              <span>{status.gridState.lastBand ?? "未初始化"}</span>
            </div>
            <div className="status-item">
              <label>交易中</label>
              <span>{status.gridState.inFlight ? "是" : "否"}</span>
            </div>
            <div className="status-item">
              <label>最后 tick</label>
              <span>{status.lastTick ? formatTimestamp(status.lastTick) : "-"}</span>
            </div>
          </div>
        )}

        <div className="actions">
          {status?.running ? (
            <button 
              onClick={() => handleControl("stop")} 
              disabled={api.loading}
              className="btn btn-danger"
            >
              ⏹ 停止
            </button>
          ) : (
            <button 
              onClick={() => handleControl("start")} 
              disabled={api.loading}
              className="btn btn-success"
            >
              ▶ 启动
            </button>
          )}
        </div>

        {!status && (
          <div className="warning-message">
            ⚠️ Bot 服务未启动或无法连接，请运行 <code>cd bot && npm run dev</code>
          </div>
        )}

        {status?.lastError && (
          <div className="error-message">
            ❌ {status.lastError}
          </div>
        )}
      </div>

      {/* 配置卡片 */}
      <div className="card config-card">
        <div className="config-header">
          <h2>⚙️ 网格配置</h2>
          <button 
            onClick={toggleEdit} 
            className="btn btn-secondary"
          >
            {showEdit ? "取消" : "编辑"}
          </button>
        </div>

        {config && (
          <>
            {showEdit ? (
              <div className="config-form">
                <div className="form-row">
                  <label>下限价格</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingConfig.lowerPrice ?? config.lowerPrice}
                    onChange={(e) => setEditingConfig({ ...editingConfig, lowerPrice: parseNumber(e.target.value, "float") })}
                  />
                </div>
                <div className="form-row">
                  <label>上限价格</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingConfig.upperPrice ?? config.upperPrice}
                    onChange={(e) => setEditingConfig({ ...editingConfig, upperPrice: parseNumber(e.target.value, "float") })}
                  />
                </div>
                <div className="form-row">
                  <label>网格层数</label>
                  <input
                    type="number"
                    min="2"
                    max="100"
                    value={editingConfig.levels ?? config.levels}
                    onChange={(e) => setEditingConfig({ ...editingConfig, levels: parseNumber(e.target.value, "int") })}
                  />
                </div>
                <div className="form-row">
                  <label>每格金额</label>
                  <input
                    type="number"
                    value={editingConfig.amountPerGrid ?? config.amountPerGrid}
                    onChange={(e) => setEditingConfig({ ...editingConfig, amountPerGrid: parseNumber(e.target.value, "float") })}
                  />
                </div>
                <div className="form-row">
                  <label>滑点 (bps)</label>
                  <input
                    type="number"
                    value={editingConfig.slippageBps ?? config.slippageBps}
                    onChange={(e) => setEditingConfig({ ...editingConfig, slippageBps: parseNumber(e.target.value, "int") })}
                  />
                </div>
                <button 
                  onClick={handleSaveConfig} 
                  disabled={api.loading}
                  className="btn btn-primary"
                >
                  {api.loading ? "保存中..." : "保存配置"}
                </button>
                {api.error && <div className="error-text">{api.error}</div>}
              </div>
            ) : (
              <div className="config-display">
                <div className="config-row">
                  <span className="config-label">价格区间</span>
                  <span className="config-value">
                    {formatPrice(config.lowerPrice)} ~ {formatPrice(config.upperPrice)} USDC/SUI
                  </span>
                </div>
                <div className="config-row">
                  <span className="config-label">网格层数</span>
                  <span className="config-value">{config.levels}</span>
                </div>
                <div className="config-row">
                  <span className="config-label">每格金额</span>
                  <span className="config-value">{config.amountPerGrid} USDC</span>
                </div>
                <div className="config-row">
                  <span className="config-label">滑点容忍</span>
                  <span className="config-value">{config.slippageBps / 100}%</span>
                </div>
                <div className="config-row">
                  <span className="config-label">交易对</span>
                  <span className="config-value">SUI / USDC</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        .bot-control {
          display: grid;
          gap: 24px;
        }
        .card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .status-header, .config-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        h2 {
          font-size: 20px;
          font-weight: 600;
        }
        .badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }
        .badge.running {
          background: #dcfce7;
          color: #166534;
        }
        .badge.stopped {
          background: #fee2e2;
          color: #991b1b;
        }
        .status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }
        .status-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .status-item label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
        }
        .status-item value {
          font-size: 16px;
          font-weight: 500;
          font-family: monospace;
        }
        .actions {
          display: flex;
          gap: 12px;
        }
        .btn {
          padding: 10px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }
        .btn:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-success {
          background: #22c55e;
          color: white;
        }
        .btn-danger {
          background: #ef4444;
          color: white;
        }
        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }
        .btn-primary {
          background: #3b82f6;
          color: white;
          margin-top: 16px;
        }
        .error-message {
          margin-top: 16px;
          padding: 12px;
          background: #fee2e2;
          color: #991b1b;
          border-radius: 8px;
          font-size: 14px;
        }
        .warning-message {
          margin-top: 16px;
          padding: 12px;
          background: #fef3c7;
          color: #92400e;
          border-radius: 8px;
          font-size: 14px;
        }
        .warning-message code {
          background: rgba(0,0,0,0.1);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
        }
        .config-display {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .config-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #eee;
        }
        .config-row:last-child {
          border-bottom: none;
        }
        .config-label {
          color: #666;
        }
        .config-value {
          font-weight: 500;
          font-family: monospace;
        }
        .config-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .form-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-row label {
          font-size: 12px;
          color: #666;
        }
        .form-row input {
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
        }
        .error-text {
          margin-top: 8px;
          color: #ef4444;
          font-size: 14px;
        }
      `}</style>
    </div>
  )
}
