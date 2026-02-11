/**
 * GridVault Bot - 主入口
 * 
 * 网格交易机器人，支持秒级 tick 执行
 */

import "dotenv/config"
import { GridStrategy } from "./strategy/grid.js"
import { QuoteService } from "./quote/service.js"
import { Executor } from "./executor/executor.js"
import { Storage } from "./storage/storage.js"
import { ApiServer, type ApiDependencies } from "./api/server.js"
import { ConfigManager } from "./config/config.js"
import type { BotStatus, GridState, GridConfig, QuoteRecord } from "./types/index.js"

// ============ 全局状态 ============

interface BotContext {
  running: boolean
  lastTick: number
  lastPrice: number | null
  lastPriceAt: number | null
  lastError: string | null
  tickInterval: ReturnType<typeof setInterval> | null
  vaultBalances: { a: bigint; b: bigint }
}

const ctx: BotContext = {
  running: false,
  lastTick: 0,
  lastPrice: null,
  lastPriceAt: null,
  lastError: null,
  tickInterval: null,
  vaultBalances: { a: BigInt(0), b: BigInt(0) },
}

// ============ 核心组件 ============

let configManager: ConfigManager
let strategy: GridStrategy
let quoteService: QuoteService
let executor: Executor
let storage: Storage
let apiServer: ApiServer

// ============ 初始化 ============

async function init(): Promise<void> {
  console.log("🚀 GridVault Bot initializing...")
  
  // 1. 加载配置
  configManager = new ConfigManager()
  const gridConfig = configManager.getGridConfig()
  const executorConfig = configManager.getExecutorConfig()
  const runtimeConfig = configManager.getRuntimeConfig()
  
  console.log("📊 Grid Config:", {
    lowerPrice: gridConfig.lowerPrice,
    upperPrice: gridConfig.upperPrice,
    levels: gridConfig.levels,
    slippageBps: gridConfig.slippageBps,
  })
  
  // 2. 验证必要配置
  const validation = configManager.validateForTrading()
  if (!validation.valid) {
    console.warn("⚠️  Missing configuration:", validation.missing.join(", "))
    console.log("   Bot will start in simulation mode (no real trades)")
  } else {
    console.log("✅ Configuration valid")
  }
  
  // 3. 初始化存储
  storage = new Storage({ databasePath: runtimeConfig.databasePath })
  await storage.init()
  console.log("✅ Storage initialized")
  
  // 4. 加载或创建网格状态
  let initialState: GridState | undefined
  
  if (validation.valid) {
    const persisted = await storage.loadState(executorConfig.vaultId)
    if (persisted) {
      initialState = persisted.gridState
      console.log("📥 Loaded persisted state, lastBand:", initialState.lastBand)
    }
  }
  
  // 5. 初始化策略
  strategy = new GridStrategy(gridConfig, initialState)
  
  // 6. 初始化报价服务
  quoteService = new QuoteService({
    rpcUrl: executorConfig.rpcUrl,
    network: executorConfig.network === "mainnet" ? "mainnet" : "testnet",
    onQuote: async (record) => {
      await storage.saveQuote(record)
      await logQuote(record)
    },
  })
  console.log("✅ Quote service initialized")
  
  // 7. 初始化执行器（如果配置完整）
  if (validation.valid) {
    executor = new Executor(executorConfig)
    console.log("✅ Executor initialized, address:", executor.getAddress())
    
    // 获取初始余额
    ctx.vaultBalances = await executor.getVaultBalances()
    console.log("💰 Vault balances:", {
      a: ctx.vaultBalances.a.toString(),
      b: ctx.vaultBalances.b.toString(),
    })
  }
  
  // 8. 启动 API 服务器
  const apiDeps: ApiDependencies = {
    storage,
    strategy,
    configManager,
    getStatus: () => getBotStatus(),
    getMarketPrice: async () => {
      try {
        const now = Date.now()
        if (ctx.lastPrice !== null && ctx.lastPriceAt && now - ctx.lastPriceAt < 10000) {
          return { price: ctx.lastPrice, timestamp: ctx.lastPriceAt }
        }
        const config = strategy.getConfig()
        const price = await quoteService.getMarketPrice(config.coinTypeA, config.coinTypeB)
        if (price !== null) {
          ctx.lastPrice = price
          ctx.lastPriceAt = Date.now()
        }
        return { price: ctx.lastPrice, timestamp: ctx.lastPriceAt }
      } catch (error) {
        console.error("[getMarketPrice] Failed:", error)
        return { price: ctx.lastPrice, timestamp: ctx.lastPriceAt }
      }
    },
    setRunning: (running: boolean) => {
      if (running) {
        startBot()
      } else {
        stopBot()
      }
    },
  }
  
  apiServer = new ApiServer({ port: runtimeConfig.apiPort }, apiDeps)
  await apiServer.start()
  
  console.log("")
  console.log("═══════════════════════════════════════")
  console.log("   GridVault Bot is ready!")
  console.log("═══════════════════════════════════════")
  console.log(`   API: http://localhost:${runtimeConfig.apiPort}`)
  console.log(`   Tick interval: ${runtimeConfig.tickIntervalMs}ms`)
  console.log("")
  console.log("   Use POST /control with body {\"command\": \"start\"} to begin trading")
  console.log("═══════════════════════════════════════")
  console.log("")
  
  // 9. 自动开始（可选）
  // startBot()
}

// ============ 核心循环 ============

async function tick(): Promise<void> {
  if (!ctx.running) return
  
  ctx.lastTick = Date.now()
  
  try {
    // 1. 获取市场价格
    const config = strategy.getConfig()
    const price = await quoteService.getMarketPrice(config.coinTypeA, config.coinTypeB)
    
    if (price === null) {
      console.warn("[tick] Failed to get market price, skipping this tick")
      await logWarning("Price fetch failed", { timestamp: Date.now() })
      return
    }
    
    ctx.lastPrice = price
    ctx.lastPriceAt = Date.now()
    
    // 2. 网格决策
    const decision = strategy.decide(price)
    
    // 3. 无论是否交易，先更新状态（包括 lastBand）
    strategy.updateState(decision.nextState)
    
    // 4. 如果没有交易动作，提前返回
    if (decision.action.type === "NONE") {
      return
    }
    
    console.log(`[tick] Price: ${price.toFixed(6)}, Band: ${strategy.getCurrentBand(price)}`)
    console.log(`[tick] Action: ${decision.action.type}, Trigger: ${decision.action.triggerPrice}`)
    
    // 5. 获取报价
    let quote
    if (decision.action.type === "SELL") {
      quote = await quoteService.getQuoteA2B(
        config.coinTypeA,
        config.coinTypeB,
        decision.action.amountIn!,
        config.slippageBps
      )
    } else {
      // BUY
      quote = await quoteService.getQuoteB2A(
        config.coinTypeA,
        config.coinTypeB,
        decision.action.amountIn!,
        config.slippageBps
      )
    }
    
    if (!quote) {
      console.warn("[tick] Failed to get quote, aborting trade")
      strategy.markTradeComplete(false)
      await logWarning("Quote fetch failed", { action: decision.action.type, timestamp: Date.now() })
      return
    }
    
    console.log(`[tick] Quote: in=${quote.amountIn}, est=${quote.estimatedOut}, min=${quote.minOut}`)
    
    // 6. 执行交易（如果配置了执行器）
    if (executor) {
      const receipt = await executor.executeTrade(
        { action: decision.action, quote },
        quoteService.getAggregator()
      )
      
      // 7. 保存交易记录
      await storage.saveTrade({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        digest: receipt.digest,
        timestamp: receipt.timestamp,
        side: decision.action.type === "SELL" ? "A2B" : "B2A",
        amountIn: quote.amountIn.toString(),
        amountOut: quote.estimatedOut.toString(),
        price: quote.price,
        status: receipt.status,
        error: receipt.error,
      })
      
      // 8. 更新状态
      if (receipt.status === "success") {
        strategy.markTradeComplete(true)
        console.log(`[tick] ✅ Trade executed: ${receipt.digest}`)
        
        // 更新余额
        ctx.vaultBalances = await executor.getVaultBalances()
        await logInfo("Trade success", { digest: receipt.digest, price: quote.price })
      } else {
        strategy.markTradeComplete(false)
        console.error(`[tick] ❌ Trade failed: ${receipt.error}`)
        await logError("Trade failed", { error: receipt.error, action: decision.action.type })
      }
    } else {
      // 模拟模式
      console.log(`[tick] 🔄 Simulated ${decision.action.type} (no executor)`)
      strategy.markTradeComplete(true)
      await logInfo("Simulated trade", { action: decision.action.type, price })
    }
    
    // 9. 持久化状态（每次 tick 后都保存，确保持久化）
    await persistState()
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error("[tick] Error:", errorMsg)
    ctx.lastError = errorMsg
    await logError("Tick error", { error: errorMsg, timestamp: Date.now() })
    
    // 标记交易失败并持久化状态
    strategy.markTradeComplete(false)
    await persistState()
  }
}

/**
 * 持久化当前状态到存储
 */
async function persistState(): Promise<void> {
  try {
    const executorConfig = configManager?.getExecutorConfig()
    if (executorConfig?.vaultId && storage) {
      await storage.saveState({
        vaultId: executorConfig.vaultId,
        gridState: strategy.getState(),
        config: strategy.getConfig(),
        updatedAt: Date.now(),
      })
    }
  } catch (error) {
    console.error("[persistState] Failed to persist state:", error)
  }
}

const DEFAULT_DECIMALS = 9
const STABLE_DECIMALS = 6

function getCoinDecimals(coinType: string): number {
  const upper = coinType.toUpperCase()
  if (upper.includes("::SUI::SUI")) return 9
  if (upper.includes("USDC") || upper.includes("USDT")) return STABLE_DECIMALS
  return DEFAULT_DECIMALS
}

function formatUnits(amount: string, decimals: number): string {
  const negative = amount.startsWith("-")
  const raw = negative ? amount.slice(1) : amount
  const padded = raw.padStart(decimals + 1, "0")
  const integer = padded.slice(0, -decimals) || "0"
  const fraction = padded.slice(-decimals).replace(/0+$/, "")
  const result = fraction ? `${integer}.${fraction}` : integer
  return negative ? `-${result}` : result
}

function formatFixed(value: bigint, decimals: number): string {
  const raw = value.toString().padStart(decimals + 1, "0")
  const integer = raw.slice(0, -decimals) || "0"
  const fraction = raw.slice(-decimals).replace(/0+$/, "")
  return fraction ? `${integer}.${fraction}` : integer
}

function formatPriceFromAmounts(
  amountIn: string,
  amountOut: string,
  decimalsIn: number,
  decimalsOut: number,
  displayDecimals: number = 6
): string {
  try {
    const inBn = BigInt(amountIn)
    const outBn = BigInt(amountOut)
    if (inBn === BigInt(0) || outBn === BigInt(0)) return "0"
    const scale = BigInt(10) ** BigInt(displayDecimals)
    const numerator = outBn * (BigInt(10) ** BigInt(decimalsIn)) * scale
    const denominator = inBn * (BigInt(10) ** BigInt(decimalsOut))
    const priceScaled = numerator / denominator
    return formatFixed(priceScaled, displayDecimals)
  } catch {
    return "0"
  }
}

async function logQuote(record: QuoteRecord): Promise<void> {
  const decimalsIn = getCoinDecimals(record.fromCoin)
  const decimalsOut = getCoinDecimals(record.targetCoin)
  const amountInFmt = formatUnits(record.amountIn, decimalsIn)
  const amountOutFmt = record.status === "success"
    ? formatUnits(record.amountOut, decimalsOut)
    : "-"
  const minOutFmt = record.status === "success"
    ? formatUnits(record.minOut, decimalsOut)
    : "-"
  const priceFmt = record.status === "success"
    ? formatPriceFromAmounts(record.amountIn, record.amountOut, decimalsIn, decimalsOut, 6)
    : "-"
  const action = record.side === "A2B" ? "SELL" : "BUY"

  if (record.status === "success") {
    await logInfo(
      `Quote ${record.side}: in ${amountInFmt} -> out ${amountOutFmt} (min ${minOutFmt}) price ${priceFmt}`,
      {
        price: priceFmt,
        action,
        amountIn: amountInFmt,
        estimatedOut: amountOutFmt,
      }
    )
  } else {
    await logWarning(
      `Quote ${record.side} failed: ${record.error ?? "Unknown error"}`,
      {
        action,
        amountIn: amountInFmt,
      }
    )
  }
}

/**
 * 记录日志到存储
 */
async function logInfo(message: string, metadata?: Record<string, any>): Promise<void> {
  if (storage) {
    await storage.writeLog("INFO", message, metadata)
  }
}

async function logWarning(message: string, metadata?: Record<string, any>): Promise<void> {
  if (storage) {
    await storage.writeLog("WARN", message, metadata)
  }
}

async function logError(message: string, metadata?: Record<string, any>): Promise<void> {
  if (storage) {
    await storage.writeLog("ERROR", message, metadata)
  }
}

// ============ 控制函数 ============

function startBot(): void {
  if (ctx.running) {
    console.log("Bot is already running")
    return
  }
  
  ctx.running = true
  ctx.lastError = null
  
  const tickIntervalMs = configManager.getRuntimeConfig().tickIntervalMs
  
  // 立即执行一次
  tick()
  
  // 启动定时器
  ctx.tickInterval = setInterval(tick, tickIntervalMs)
  
  console.log(`🟢 Bot started (tick interval: ${tickIntervalMs}ms)`)
}

function stopBot(): void {
  if (!ctx.running) {
    console.log("Bot is already stopped")
    return
  }
  
  ctx.running = false
  
  if (ctx.tickInterval) {
    clearInterval(ctx.tickInterval)
    ctx.tickInterval = null
  }
  
  console.log("🔴 Bot stopped")
}

// ============ 状态获取 ============

function getBotStatus(): BotStatus {
  return {
    running: ctx.running,
    vaultId: configManager?.getExecutorConfig().vaultId ?? "",
    balances: {
      a: ctx.vaultBalances.a.toString(),
      b: ctx.vaultBalances.b.toString(),
    },
    gridState: strategy?.getState() ?? { lastBand: null, inFlight: false, lastTradeTime: null },
    lastPrice: ctx.lastPrice,
    lastPriceAt: ctx.lastPriceAt,
    lastTick: ctx.lastTick,
    lastError: ctx.lastError,
  }
}

// ============ 优雅退出 ============

async function shutdown(): Promise<void> {
  console.log("\n👋 Shutting down...")
  
  stopBot()
  
  if (apiServer) {
    await apiServer.stop()
  }
  
  if (storage) {
    await storage.close()
  }
  
  console.log("✅ Goodbye!")
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

// ============ 启动 ============

init().catch((error) => {
  console.error("Failed to initialize:", error)
  process.exit(1)
})
