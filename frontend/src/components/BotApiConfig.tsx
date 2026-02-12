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
    setMessage(`已切换到 ${normalized}`)
  }

  const restoreDefault = () => {
    const fallback = resetBotApiUrl()
    setApiUrlInput(fallback)
    setActiveApiUrl(fallback)
    setMessage(`已恢复默认 ${fallback}`)
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

      setMessage(`连接成功: ${target}`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error"
      setMessage(`连接失败: ${reason}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="bot-api-config">
      <div className="card">
        <div className="header">
          <h2>Bot API</h2>
          <span className="active">当前: {activeApiUrl || "-"}</span>
        </div>

        <input
          type="text"
          value={apiUrlInput}
          onChange={(event) => setApiUrlInput(event.target.value)}
          placeholder="http://localhost:3215"
          className="input"
        />

        <div className="actions">
          <button onClick={applyApiUrl} className="btn btn-primary">应用地址</button>
          <button onClick={testConnection} disabled={testing} className="btn btn-secondary">
            {testing ? "测试中..." : "测试连接"}
          </button>
          <button onClick={restoreDefault} className="btn btn-tertiary">恢复默认</button>
        </div>

        <p className="hint">默认地址: {BOT_API_URL}</p>
        {message && <p className="message">{message}</p>}
      </div>

      <style jsx>{`
        .bot-api-config {
          margin-bottom: 24px;
        }

        .card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
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
        }

        .active {
          font-size: 12px;
          color: #4b5563;
          font-family: monospace;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 360px;
        }

        .input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 12px;
        }

        .actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn {
          border: none;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 13px;
          cursor: pointer;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #2563eb;
          color: white;
        }

        .btn-secondary {
          background: #111827;
          color: white;
        }

        .btn-tertiary {
          background: #e5e7eb;
          color: #111827;
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
          color: #111827;
        }
      `}</style>
    </div>
  )
}
