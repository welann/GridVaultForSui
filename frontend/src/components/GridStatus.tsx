"use client"

import { useEffect, useCallback, useState, useRef } from "react"
import { useBotApi, type BotStatus, type GridConfig } from "@/hooks/useBotApi"
import { computeGridLines, formatPrice, formatTimestamp } from "@/lib/utils"

export function GridStatus() {
  const api = useBotApi()
  const [status, setStatus] = useState<BotStatus | null>(null)
  const [config, setConfig] = useState<GridConfig | null>(null)
  const [price, setPrice] = useState<number | null>(null)
  const [priceAt, setPriceAt] = useState<number | null>(null)
  const [priceError, setPriceError] = useState<string | null>(null)
  const lastPriceFetchAtRef = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    const [s, c] = await Promise.all([api.fetchStatus(), api.fetchConfig()])
    if (s) setStatus(s)
    if (c) setConfig(c)

    if (s && s.lastPrice !== null) {
      setPrice(s.lastPrice)
      setPriceAt(s.lastPriceAt ?? s.lastTick)
      setPriceError(null)
      return
    }

    const now = Date.now()
    const lastFetch = lastPriceFetchAtRef.current
    const canFetch = !lastFetch || now - lastFetch > 15000
    if (!canFetch) return

    lastPriceFetchAtRef.current = now
    const priceData = await api.fetchPrice()
    if (priceData && priceData.price !== null) {
      setPrice(priceData.price)
      setPriceAt(priceData.timestamp ?? now)
      setPriceError(null)
    } else {
      setPriceError("价格获取失败")
    }
  }, [api])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  }, [refresh])

  const getNearestLines = (price: number, lines: number[]): [number, number] | null => {
    if (lines.length < 2) return null
    if (price <= lines[0]) return [lines[0], lines[1]]
    if (price >= lines[lines.length - 1]) {
      return [lines[lines.length - 2], lines[lines.length - 1]]
    }
    for (let i = 0; i < lines.length - 1; i++) {
      if (price >= lines[i] && price < lines[i + 1]) {
        return [lines[i], lines[i + 1]]
      }
    }
    return null
  }

  const lines = config ? computeGridLines(config.lowerPrice, config.upperPrice, config.levels) : []
  const currentPrice = price ?? status?.lastPrice ?? null
  const nearest = currentPrice !== null ? getNearestLines(currentPrice, lines) : null
  const fallbackNearest = !nearest && status?.gridState.lastBand !== null && lines.length > 1
    ? [lines[Math.max(status.gridState.lastBand, 0)], lines[Math.min(status.gridState.lastBand + 1, lines.length - 1)]] as [number, number]
    : null

  return (
    <div className="grid-status">
      <div className="card">
        <h2>📈 网格状态</h2>

        <div className="row">
          <span className="label">当前价格</span>
          <span className="value">
            {currentPrice !== null ? `${formatPrice(currentPrice)} USDC/SUI` : "-"}
          </span>
        </div>

        <div className="row">
          <span className="label">最近网格</span>
          <span className="value">
            {nearest
              ? `${formatPrice(nearest[0])} ~ ${formatPrice(nearest[1])}`
              : fallbackNearest
              ? `${formatPrice(fallbackNearest[0])} ~ ${formatPrice(fallbackNearest[1])}`
              : "-"}
          </span>
        </div>

        <div className="row">
          <span className="label">当前档位</span>
          <span className="value">{status?.gridState.lastBand ?? "未初始化"}</span>
        </div>

        <div className="row">
          <span className="label">交易中</span>
          <span className={`value ${status?.gridState.inFlight ? "warn" : "ok"}`}>
            {status?.gridState.inFlight ? "是" : "否"}
          </span>
        </div>

        <div className="row">
          <span className="label">最后更新</span>
          <span className="value">
            {priceAt ? formatTimestamp(priceAt) : status?.lastTick ? formatTimestamp(status.lastTick) : "-"}
          </span>
        </div>

        {priceError && (
          <div className="hint">{priceError}，请检查 Bot 或网络</div>
        )}
        {!status && (
          <div className="hint">Bot 未运行或无法连接</div>
        )}
      </div>

      <style jsx>{`
        .grid-status {
          margin-bottom: 24px;
        }
        .card {
          background: white;
          border-radius: 12px;
          padding: 20px 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h2 {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 16px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #eee;
        }
        .row:last-child {
          border-bottom: none;
        }
        .label {
          color: #666;
          font-size: 13px;
        }
        .value {
          font-family: monospace;
          font-weight: 600;
          color: #111827;
        }
        .value.warn {
          color: #b45309;
        }
        .value.ok {
          color: #047857;
        }
        .hint {
          margin-top: 12px;
          font-size: 12px;
          color: #92400e;
          background: #fef3c7;
          padding: 8px 12px;
          border-radius: 8px;
        }
      `}</style>
    </div>
  )
}
