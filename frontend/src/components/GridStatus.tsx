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
      setPriceError("Failed to fetch price")
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
  const lastBand = status?.gridState.lastBand
  const fallbackNearest = !nearest && lastBand !== null && lastBand !== undefined && lines.length > 1
    ? [lines[Math.max(lastBand, 0)], lines[Math.min(lastBand + 1, lines.length - 1)]] as [number, number]
    : null

  return (
    <div className="grid-status">
      <div className="card">
        <h2>📈 Grid Status</h2>

        <div className="row">
          <span className="label">Current Price</span>
          <span className="value">
            {currentPrice !== null ? `${formatPrice(currentPrice)} USDC/SUI` : "-"}
          </span>
        </div>

        <div className="row">
          <span className="label">Nearest Grid</span>
          <span className="value">
            {nearest
              ? `${formatPrice(nearest[0])} ~ ${formatPrice(nearest[1])}`
              : fallbackNearest
              ? `${formatPrice(fallbackNearest[0])} ~ ${formatPrice(fallbackNearest[1])}`
              : "-"}
          </span>
        </div>

        <div className="row">
          <span className="label">Current Band</span>
          <span className={`value band ${status?.gridState.lastBand !== null && status?.gridState.lastBand !== undefined ? 'active' : ''}`}>
            {status?.gridState.lastBand ?? "Not Initialized"}
          </span>
        </div>

        <div className="row">
          <span className="label">In Flight</span>
          <span className={`value ${status?.gridState.inFlight ? "in-flight" : "ok"}`}>
            {status?.gridState.inFlight ? "🔄 In Progress" : "✓ Ready"}
          </span>
        </div>

        <div className="row">
          <span className="label">Last Updated</span>
          <span className="value">
            {priceAt ? formatTimestamp(priceAt) : status?.lastTick ? formatTimestamp(status.lastTick) : "-"}
          </span>
        </div>

        {priceError && (
          <div className="hint error">⚠️ {priceError}, please check Bot or network</div>
        )}
        {!status && (
          <div className="hint warning">⚠️ Bot not running or connection failed</div>
        )}
      </div>

      <style jsx>{`
        .grid-status {
          margin-bottom: 24px;
        }
        .card {
          background: rgba(23, 23, 30, 0.8);
          border: 1px solid rgba(99, 102, 241, 0.15);
          border-radius: 16px;
          padding: 20px 24px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          color: #e5e7eb;
        }
        h2 {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 16px;
          color: #e5e7eb;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid rgba(99, 102, 241, 0.1);
        }
        .row:last-child {
          border-bottom: none;
        }
        .label {
          color: #6b7280;
          font-size: 13px;
        }
        .value {
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
          font-weight: 600;
          color: #e5e7eb;
        }
        .value.band {
          background: rgba(99, 102, 241, 0.15);
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 13px;
        }
        .value.band.active {
          background: rgba(99, 102, 241, 0.25);
          color: #818cf8;
        }
        .value.in-flight {
          color: #fbbf24;
          font-size: 12px;
        }
        .value.ok {
          color: #4ade80;
          font-size: 12px;
        }
        .hint {
          margin-top: 12px;
          font-size: 12px;
          padding: 10px 14px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .hint.warning {
          color: #fbbf24;
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.2);
        }
        .hint.error {
          color: #f87171;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
      `}</style>
    </div>
  )
}
