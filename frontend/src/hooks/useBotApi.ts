"use client"

import { useState, useCallback } from "react"
import { getBotApiUrl } from "@/lib/botApiUrl"

export interface BotStatus {
  running: boolean
  vaultId: string
  balances: {
    a: string
    b: string
  }
  gridState: {
    lastBand: number | null
    inFlight: boolean
    lastTradeTime: number | null
  }
  lastPrice: number | null
  lastPriceAt: number | null
  lastTick: number
  lastError: string | null
}

export interface GridConfig {
  lowerPrice: number
  upperPrice: number
  levels: number
  amountPerGrid: number
  slippageBps: number
  coinTypeA: string
  coinTypeB: string
}

export interface TradeRecord {
  id: string
  digest: string
  timestamp: number
  side: "A2B" | "B2A"
  amountIn: string
  amountOut: string
  price: number
  status: "success" | "failure"
  error?: string
}

export interface QuoteRecord {
  id: string
  timestamp: number
  side: "A2B" | "B2A"
  fromCoin: string
  targetCoin: string
  amountIn: string
  amountOut: string
  minOut: string
  price: number | null
  priceImpact: number | null
  byAmountIn: boolean
  quoteId?: string
  status: "success" | "failure"
  error?: string
}

export interface LogEntry {
  id: number
  timestamp: number
  level: "INFO" | "WARN" | "ERROR"
  message: string
  metadata?: string
}

export function useBotApi() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async (): Promise<BotStatus | null> => {
    try {
      const res = await fetch(`${getBotApiUrl()}/status`, {
        // Add timeout to avoid long waiting
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error("Failed to fetch status")
      return await res.json()
    } catch (e) {
      // Silent fail to avoid console errors affecting UX
      // Error will be displayed in UI via state
      return null
    }
  }, [])

  const fetchPrice = useCallback(async (): Promise<{ price: number | null; timestamp: number | null } | null> => {
    try {
      const res = await fetch(`${getBotApiUrl()}/price`)
      if (!res.ok) throw new Error("Failed to fetch price")
      return await res.json()
    } catch (e) {
      console.error("fetchPrice error:", e)
      return null
    }
  }, [])

  const fetchHistory = useCallback(async (limit: number = 100): Promise<TradeRecord[]> => {
    try {
      const res = await fetch(`${getBotApiUrl()}/history?limit=${limit}`)
      if (!res.ok) throw new Error("Failed to fetch history")
      const data = await res.json()
      return data.trades || []
    } catch (e) {
      console.error("fetchHistory error:", e)
      return []
    }
  }, [])

  const fetchQuotes = useCallback(async (limit: number = 200): Promise<QuoteRecord[]> => {
    try {
      const res = await fetch(`${getBotApiUrl()}/quotes?limit=${limit}`)
      if (!res.ok) throw new Error("Failed to fetch quotes")
      const data = await res.json()
      return data.quotes || []
    } catch (e) {
      console.error("fetchQuotes error:", e)
      return []
    }
  }, [])

  const fetchConfig = useCallback(async (): Promise<GridConfig | null> => {
    try {
      const res = await fetch(`${getBotApiUrl()}/config`)
      if (!res.ok) throw new Error("Failed to fetch config")
      const data = await res.json()
      return data.config
    } catch (e) {
      console.error("fetchConfig error:", e)
      return null
    }
  }, [])

  const updateConfig = useCallback(async (config: Partial<GridConfig>): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${getBotApiUrl()}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to update config")
      }
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const controlBot = useCallback(async (command: "start" | "stop" | "pause" | "resume"): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${getBotApiUrl()}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to control bot")
      }
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchLogs = useCallback(async (limit: number = 50): Promise<LogEntry[]> => {
    try {
      const res = await fetch(`${getBotApiUrl()}/logs?limit=${limit}`)
      if (!res.ok) throw new Error("Failed to fetch logs")
      const data = await res.json()
      return data.logs || []
    } catch (e) {
      console.error("fetchLogs error:", e)
      return []
    }
  }, [])

  return {
    loading,
    error,
    fetchStatus,
    fetchPrice,
    fetchHistory,
    fetchQuotes,
    fetchConfig,
    updateConfig,
    controlBot,
    fetchLogs,
  }
}
