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
          <h2>📜 交易历史</h2>
          <button onClick={loadHistory} className="btn btn-secondary">
            刷新
          </button>
        </div>

        {trades.length === 0 ? (
          <div className="empty">暂无交易记录</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>方向</th>
                  <th>输入</th>
                  <th>输出</th>
                  <th>价格</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr key={trade.id} className={trade.status}>
                    <td>{formatTimestamp(trade.timestamp)}</td>
                    <td>
                      <span className={`side ${trade.side}`}>
                        {trade.side === "A2B" ? "卖出 SUI" : "买入 SUI"}
                      </span>
                    </td>
                    <td>{formatAmount(trade.amountIn, trade.side === "A2B" ? 9 : 6)}</td>
                    <td>{formatAmount(trade.amountOut, trade.side === "A2B" ? 6 : 9)}</td>
                    <td>{trade.price.toFixed(6)}</td>
                    <td>
                      <span className={`status ${trade.status}`}>
                        {trade.status === "success" ? "✓ 成功" : "✗ 失败"}
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
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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
        }
        .btn {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
        }
        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }
        .btn:hover {
          opacity: 0.8;
        }
        .empty {
          text-align: center;
          padding: 40px;
          color: #666;
        }
        .table-container {
          overflow-x: auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }
        th {
          font-weight: 600;
          color: #666;
          font-size: 12px;
          text-transform: uppercase;
        }
        tr:hover {
          background: #f9fafb;
        }
        .side {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }
        .side.A2B {
          background: #fef3c7;
          color: #92400e;
        }
        .side.B2A {
          background: #dbeafe;
          color: #1e40af;
        }
        .status {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }
        .status.success {
          background: #dcfce7;
          color: #166534;
        }
        .status.failure {
          background: #fee2e2;
          color: #991b1b;
        }
        tr.failure {
          opacity: 0.7;
        }
      `}</style>
    </div>
  )
}
