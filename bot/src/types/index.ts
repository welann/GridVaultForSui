/**
 * GridVault Bot - 核心类型定义
 */

import type { Transaction } from "@mysten/sui/transactions"

// ============ 网格策略相关 ============

export interface GridConfig {
  /** 网格下限价格 */
  lowerPrice: number
  /** 网格上限价格 */
  upperPrice: number
  /** 网格层级数量 */
  levels: number
  /** 每个网格的投资金额（以 B 代币计） */
  amountPerGrid: number
  /** 滑点容忍度（bps，默认 50） */
  slippageBps: number
  /** 交易对：代币 A 的完整类型（如 SUI） */
  coinTypeA: string
  /** 交易对：代币 B 的完整类型（如 USDC） */
  coinTypeB: string
}

export interface GridState {
  /** 当前所在网格档位（null 表示未初始化） */
  lastBand: number | null
  /** 是否有正在执行的交易 */
  inFlight: boolean
  /** 上次交易时间戳 */
  lastTradeTime: number | null
}

export type ActionType = "BUY" | "SELL" | "NONE"

export interface GridAction {
  type: ActionType
  /** 触发价格（档位边界价格） */
  triggerPrice?: number
  /** 输入金额 */
  amountIn?: bigint
  /** 期望最小输出 */
  minOut?: bigint
  /** 路由数据（由 Cetus Aggregator 提供） */
  route?: RouterData
}

export interface GridDecision {
  action: GridAction
  nextState: GridState
}

// ============ 报价服务相关 ============

export interface RouterData {
  /** Cetus Aggregator 路由数据 */
  route: any
  /** 预估输出金额 */
  estimatedOut: bigint
  /** 价格影响 */
  priceImpact: number
}

export interface QuoteResult {
  side: "A2B" | "B2A"
  amountIn: bigint
  estimatedOut: bigint
  minOut: bigint
  routerData: RouterData
  price: number
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

// ============ 交易执行相关 ============

export interface ExecutorConfig {
  /** 私钥（从环境变量读取） */
  privateKey: string
  /** RPC 端点 */
  rpcUrl: string
  /** 网络类型 */
  network: "testnet" | "mainnet" | "localnet"
  /** Vault 对象 ID */
  vaultId: string
  /** TraderCap 对象 ID */
  traderCapId: string
  /** 合约包 ID */
  packageId: string
  /** Gas 预算 */
  gasBudget: number
  /** 交易超时时间（毫秒） */
  txTimeoutMs: number
  /** 代币 A 类型 */
  coinTypeA: string
  /** 代币 B 类型 */
  coinTypeB: string
  /** 滑点容忍度（bps，如 50 表示 0.5%） */
  slippageBps: number
}

export interface TradeReceipt {
  digest: string
  status: "success" | "failure"
  events: any[]
  timestamp: number
  error?: string
  amountOut?: bigint
}

// ============ 存储相关 ============

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

export interface PersistedState {
  vaultId: string
  gridState: GridState
  config: GridConfig
  updatedAt: number
}

// ============ API 相关 ============

export interface BotStatus {
  running: boolean
  vaultId: string
  balances: {
    a: string
    b: string
  }
  gridState: GridState
  lastPrice: number | null
  lastPriceAt: number | null
  lastTick: number
  lastError: string | null
}

export interface ConfigUpdateRequest {
  config: Partial<GridConfig>
}

export interface ControlCommand {
  command: "start" | "stop" | "pause" | "resume"
}

// ============ GridVault 合约事件类型 ============

/**
 * Sui 链上事件的基础结构
 */
export interface SuiEvent {
  type: string
  timestampMs?: string
  id?: {
    txDigest: string
    eventSeq: string
  }
  parsedJson?: Record<string, unknown>
}

/**
 * GridVault TradeEvent - 交易执行后触发
 * 
 * 对应 Move 合约中的:
 * ```move
 * struct TradeEvent has copy, drop {
 *   vault_id: ID,
 *   trader: address,
 *   is_a_to_b: bool,
 *   amount_in: u64,
 *   amount_out: u64,
 *   price: u64,
 *   timestamp: u64
 * }
 * ```
 */
export interface TradeEvent extends SuiEvent {
  type: string  // `${packageId}::grid_vault::TradeEvent`
  parsedJson: {
    vault_id: string
    trader: string
    is_a_to_b: boolean
    amount_in: string  // Sui 中的 u64 在 JSON 中是 string
    amount_out: string
    price: string
    timestamp: string
  }
}

/**
 * GridVault DepositEvent - 存款事件
 */
export interface DepositEvent extends SuiEvent {
  type: string
  parsedJson: {
    vault_id: string
    depositor: string
    is_token_a: boolean
    amount: string
    timestamp: string
  }
}

/**
 * GridVault WithdrawEvent - 提款事件
 */
export interface WithdrawEvent extends SuiEvent {
  type: string
  parsedJson: {
    vault_id: string
    withdrawer: string
    is_token_a: boolean
    amount: string
    timestamp: string
  }
}

/**
 * 类型守卫：检查事件是否为 TradeEvent
 */
export function isTradeEvent(event: unknown): event is TradeEvent {
  if (typeof event !== "object" || event === null) return false
  
  const e = event as Record<string, unknown>
  if (typeof e.type !== "string") return false
  if (!e.type.includes("TradeEvent")) return false
  
  const parsed = e.parsedJson as Record<string, unknown> | undefined
  if (!parsed) return false
  
  // 验证必要字段存在且类型正确
  return (
    typeof parsed.vault_id === "string" &&
    typeof parsed.trader === "string" &&
    typeof parsed.is_a_to_b === "boolean" &&
    typeof parsed.amount_in === "string" &&
    typeof parsed.amount_out === "string"
  )
}

/**
 * 类型守卫：检查事件是否为 DepositEvent
 */
export function isDepositEvent(event: unknown): event is DepositEvent {
  if (typeof event !== "object" || event === null) return false
  
  const e = event as Record<string, unknown>
  if (typeof e.type !== "string") return false
  if (!e.type.includes("DepositEvent")) return false
  
  const parsed = e.parsedJson as Record<string, unknown> | undefined
  if (!parsed) return false
  
  return (
    typeof parsed.vault_id === "string" &&
    typeof parsed.depositor === "string" &&
    typeof parsed.amount === "string"
  )
}

/**
 * 从事件中安全提取 amount_out
 * @returns bigint | undefined 如果事件无效则返回 undefined
 */
export function getAmountOutFromEvent(event: unknown): bigint | undefined {
  if (!isTradeEvent(event)) return undefined
  
  try {
    return BigInt(event.parsedJson.amount_out)
  } catch {
    return undefined
  }
}

// ============ 市场数据相关 ============

export interface MarketSnapshot {
  price: number
  timestamp: number
  source: string
}
