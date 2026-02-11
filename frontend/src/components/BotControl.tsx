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

  // Refresh status
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

  // Auto refresh
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
      {/* Status Card */}
      <div className="card status-card">
        <div className="status-header">
          <h2>🤖 Bot Status</h2>
          <span className={`badge ${status?.running ? "running" : "stopped"}`}>
            {status?.running ? "Running" : "Stopped"}
          </span>
        </div>

        {status && (
          <div className="status-grid">
            <div className="status-item">
              <label>Vault ID</label>
              <span>{status.vaultId ? status.vaultId.slice(0, 16) + "..." : "-"}</span>
            </div>
            <div className="status-item">
              <label>SUI Balance</label>
              <span>{formatAmount(status.balances.a)} SUI</span>
            </div>
            <div className="status-item">
              <label>USDC Balance</label>
              <span>{formatAmount(status.balances.b, 6)} USDC</span>
            </div>
            <div className="status-item">
              <label>Current Band</label>
              <span>{status.gridState.lastBand ?? "Not Init"}</span>
            </div>
            <div className="status-item">
              <label>In Flight</label>
              <span>{status.gridState.inFlight ? "Yes" : "No"}</span>
            </div>
            <div className="status-item">
              <label>Last Tick</label>
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
              ⏹ Stop
            </button>
          ) : (
            <button 
              onClick={() => handleControl("start")} 
              disabled={api.loading}
              className="btn btn-success"
            >
              ▶ Start
            </button>
          )}
        </div>

        {!status && (
          <div className="warning-message">
            ⚠️ Bot service not started or connection failed, run <code>cd bot && npm run dev</code>
          </div>
        )}

        {status?.lastError && (
          <div className="error-message">
            ❌ {status.lastError}
          </div>
        )}
      </div>

      {/* Config Card */}
      <div className="card config-card">
        <div className="config-header">
          <h2>⚙️ Grid Config</h2>
          <button 
            onClick={toggleEdit} 
            className="btn btn-secondary"
          >
            {showEdit ? "Cancel" : "Edit"}
          </button>
        </div>

        {config && (
          <>
            {showEdit ? (
              <div className="config-form">
                <div className="form-row">
                  <label>Lower Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingConfig.lowerPrice ?? config.lowerPrice}
                    onChange={(e) => setEditingConfig({ ...editingConfig, lowerPrice: parseNumber(e.target.value, "float") })}
                  />
                </div>
                <div className="form-row">
                  <label>Upper Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingConfig.upperPrice ?? config.upperPrice}
                    onChange={(e) => setEditingConfig({ ...editingConfig, upperPrice: parseNumber(e.target.value, "float") })}
                  />
                </div>
                <div className="form-row">
                  <label>Grid Levels</label>
                  <input
                    type="number"
                    min="2"
                    max="100"
                    value={editingConfig.levels ?? config.levels}
                    onChange={(e) => setEditingConfig({ ...editingConfig, levels: parseNumber(e.target.value, "int") })}
                  />
                </div>
                <div className="form-row">
                  <label>Amount Per Grid</label>
                  <input
                    type="number"
                    value={editingConfig.amountPerGrid ?? config.amountPerGrid}
                    onChange={(e) => setEditingConfig({ ...editingConfig, amountPerGrid: parseNumber(e.target.value, "float") })}
                  />
                </div>
                <div className="form-row">
                  <label>Slippage (bps)</label>
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
                  {api.loading ? "Saving..." : "Save Config"}
                </button>
                {api.error && <div className="error-text">{api.error}</div>}
              </div>
            ) : (
              <div className="config-display">
                <div className="config-row">
                  <span className="config-label">Price Range</span>
                  <span className="config-value">
                    {formatPrice(config.lowerPrice)} ~ {formatPrice(config.upperPrice)} USDC/SUI
                  </span>
                </div>
                <div className="config-row">
                  <span className="config-label">Grid Levels</span>
                  <span className="config-value">{config.levels}</span>
                </div>
                <div className="config-row">
                  <span className="config-label">Amount Per Grid</span>
                  <span className="config-value">{config.amountPerGrid} USDC</span>
                </div>
                <div className="config-row">
                  <span className="config-label">Slippage Tolerance</span>
                  <span className="config-value">{config.slippageBps / 100}%</span>
                </div>
                <div className="config-row">
                  <span className="config-label">Trading Pair</span>
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
          background: rgba(23, 23, 30, 0.8);
          border: 1px solid rgba(99, 102, 241, 0.15);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          color: #e5e7eb;
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
          color: #e5e7eb;
        }
        .badge {
          padding: 6px 14px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .badge.running {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }
        .badge.stopped {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
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
          font-size: 11px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .status-item span {
          font-size: 14px;
          font-weight: 500;
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
          color: #e5e7eb;
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
          border: none;
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
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          color: white;
        }
        .btn-danger {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
        }
        .btn-secondary {
          background: rgba(99, 102, 241, 0.1);
          color: #a5b4fc;
          border: 1px solid rgba(99, 102, 241, 0.2);
        }
        .btn-secondary:hover:not(:disabled) {
          background: rgba(99, 102, 241, 0.2);
        }
        .btn-primary {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          margin-top: 16px;
        }
        .error-message {
          margin-top: 16px;
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #f87171;
          border-radius: 8px;
          font-size: 14px;
        }
        .warning-message {
          margin-top: 16px;
          padding: 12px 16px;
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.2);
          color: #fbbf24;
          border-radius: 8px;
          font-size: 14px;
        }
        .warning-message code {
          background: rgba(0,0,0,0.3);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
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
          border-bottom: 1px solid rgba(99, 102, 241, 0.1);
        }
        .config-row:last-child {
          border-bottom: none;
        }
        .config-label {
          color: #6b7280;
          font-size: 14px;
        }
        .config-value {
          font-weight: 500;
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
          color: #e5e7eb;
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
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .form-row input {
          padding: 10px 12px;
          background: rgba(17, 17, 24, 0.8);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 8px;
          font-size: 14px;
          color: #e5e7eb;
          transition: all 0.2s;
        }
        .form-row input:focus {
          outline: none;
          border-color: rgba(99, 102, 241, 0.5);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }
        .error-text {
          margin-top: 8px;
          color: #f87171;
          font-size: 14px;
        }
      `}</style>
    </div>
  )
}
