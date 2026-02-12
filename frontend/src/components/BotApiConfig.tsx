"use client"

import { useCallback, useEffect, useState } from "react"
import { BOT_API_URL } from "@/lib/constants"
import {
  BOT_API_URL_CHANGE_EVENT,
  getBotApiUrl,
  normalizeBotApiUrl,
  resetBotApiUrl,
  setBotApiUrl,
} from "@/lib/botApiUrl"

export function BotApiConfig() {
  const [apiUrlInput, setApiUrlInput] = useState("")
  const [activeApiUrl, setActiveApiUrl] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  const syncApiUrl = useCallback(() => {
    const current = getBotApiUrl()
    setApiUrlInput(current)
    setActiveApiUrl(current)
  }, [])

  useEffect(() => {
    syncApiUrl()

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === null || event.key.includes("gridvault.bot_api_url")) {
        syncApiUrl()
      }
    }

    const handleLocalChange = () => {
      syncApiUrl()
    }

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener(BOT_API_URL_CHANGE_EVENT, handleLocalChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener(BOT_API_URL_CHANGE_EVENT, handleLocalChange)
    }
  }, [syncApiUrl])

  const applyApiUrl = () => {
    const normalized = setBotApiUrl(apiUrlInput)
    setApiUrlInput(normalized)
    setActiveApiUrl(normalized)
    setMessage(`Switched to ${normalized}`)
  }

  const restoreDefault = () => {
    const fallback = resetBotApiUrl()
    setApiUrlInput(fallback)
    setActiveApiUrl(fallback)
    setMessage(`Reset to default ${fallback}`)
  }

  const testConnection = async () => {
    setTesting(true)
    setMessage(null)

    const target = normalizeBotApiUrl(apiUrlInput)

    try {
      const response = await fetch(`${target}/status`, {
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      setMessage(`Connected: ${target}`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error"
      setMessage(`Connection failed: ${reason}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="bot-api-config">
      <div className="card">
        <div className="header">
          <h2>Bot API</h2>
          <span className="active">Current: {activeApiUrl || "-"}</span>
        </div>

        <input
          type="text"
          value={apiUrlInput}
          onChange={(event) => setApiUrlInput(event.target.value)}
          placeholder="http://localhost:3215"
          className="input"
        />

        <div className="actions">
          <button onClick={applyApiUrl} className="btn btn-primary">Apply</button>
          <button onClick={testConnection} disabled={testing} className="btn btn-secondary">
            {testing ? "Testing..." : "Test Connection"}
          </button>
          <button onClick={restoreDefault} className="btn btn-tertiary">Reset</button>
        </div>

        {/* <p className="hint">Default: {BOT_API_URL}</p> */}
        {message && <p className="message">{message}</p>}
      </div>

      <style jsx>{`
        .bot-api-config {
          margin-bottom: 24px;
        }

        .card {
          background: rgba(23, 23, 30, 0.8);
          border: 1px solid rgba(99, 102, 241, 0.15);
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          color: #e5e7eb;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #e5e7eb;
        }

        .active {
          font-size: 12px;
          color: #818cf8;
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 360px;
        }

        .input {
          width: 100%;
          padding: 10px 12px;
          background: rgba(17, 17, 24, 0.8);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 8px;
          font-size: 14px;
          color: #e5e7eb;
          margin-bottom: 12px;
          transition: all 0.2s;
        }
        .input:focus {
          outline: none;
          border-color: rgba(99, 102, 241, 0.5);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }
        .input::placeholder {
          color: #4b5563;
        }

        .actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn {
          border: none;
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        .btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
        }
        .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .btn-secondary {
          background: rgba(99, 102, 241, 0.1);
          color: #a5b4fc;
          border: 1px solid rgba(99, 102, 241, 0.2);
        }
        .btn-secondary:hover:not(:disabled) {
          background: rgba(99, 102, 241, 0.2);
        }

        .btn-tertiary {
          background: rgba(17, 17, 24, 0.6);
          color: #6b7280;
          border: 1px solid rgba(99, 102, 241, 0.1);
        }
        .btn-tertiary:hover:not(:disabled) {
          background: rgba(99, 102, 241, 0.1);
          color: #a5b4fc;
        }

        .hint {
          margin-top: 12px;
          margin-bottom: 0;
          color: #6b7280;
          font-size: 12px;
        }

        .message {
          margin-top: 8px;
          margin-bottom: 0;
          font-size: 13px;
          color: #a5b4fc;
          padding: 8px 12px;
          background: rgba(99, 102, 241, 0.1);
          border-radius: 6px;
          border: 1px solid rgba(99, 102, 241, 0.15);
        }
      `}</style>
    </div>
  )
}
