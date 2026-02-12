"use client"

import { useState, useEffect } from "react"
import { useBotApi, type TradeRecord } from "@/hooks/useBotApi"
import { formatAmount, formatTimestamp } from "@/lib/utils"

export function TradeHistory() {
  const api = useBotApi()
  const [trades, setTrades] = useState<TradeRecord[]>([])

  const loadHistory = async () => {
    const data = await api.fetchHistory(50)
    setTrades(data)
  }

  useEffect(() => {
    loadHistory()
    const interval = setInterval(loadHistory, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="trade-history">
      <div className="card">
        <div className="header">
          <h2>📜 Trade History</h2>
          <button onClick={loadHistory} className="btn btn-secondary">
            Refresh
          </button>
        </div>

        {trades.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📊</div>
            <p>No trade records yet</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Side</th>
                  <th>Input</th>
                  <th>Output</th>
                  <th>Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr key={trade.id} className={trade.status}>
                    <td>{formatTimestamp(trade.timestamp)}</td>
                    <td>
                      <span className={`side ${trade.side}`}>
                        {trade.side === "A2B" ? "Sell SUI" : "Buy SUI"}
                      </span>
                    </td>
                    <td>{formatAmount(trade.amountIn, trade.side === "A2B" ? 9 : 6)}</td>
                    <td>{formatAmount(trade.amountOut, trade.side === "A2B" ? 6 : 9)}</td>
                    <td>{trade.price.toFixed(6)}</td>
                    <td>
                      <span className={`status ${trade.status}`}>
                        {trade.status === "success" ? "✓ Success" : "✗ Failed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .trade-history {
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
          margin-bottom: 20px;
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
        .table-container {
          overflow-x: auto;
          border-radius: 8px;
          border: 1px solid rgba(99, 102, 241, 0.1);
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid rgba(99, 102, 241, 0.1);
        }
        th {
          font-weight: 600;
          color: #9ca3af;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: rgba(17, 17, 24, 0.6);
        }
        tr:hover {
          background: rgba(99, 102, 241, 0.05);
        }
        tbody tr:last-child td {
          border-bottom: none;
        }
        .side {
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .side.A2B {
          background: rgba(251, 191, 36, 0.15);
          color: #fbbf24;
        }
        .side.B2A {
          background: rgba(99, 102, 241, 0.15);
          color: #a5b4fc;
        }
        .status {
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .status.success {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
        }
        .status.failure {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }
        tr.failure {
          opacity: 0.7;
        }
      `}</style>
    </div>
  )
}
