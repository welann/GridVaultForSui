/**
 * 配置管理模块
 * 
 * 支持从环境变量和配置文件加载配置
 */

import { z } from "zod"
import type { GridConfig, ExecutorConfig } from "../types/index.js"

// 环境变量 Schema
const envSchema = z.object({
  // 网络配置
  SUI_NETWORK: z.enum(["testnet", "mainnet", "localnet"]).default("testnet"),
  SUI_RPC_URL: z.string().url().optional(),
  
  // 密钥配置（二选一）
  SUI_PRIVATE_KEY: z.string().optional(),
  SUI_MNEMONIC: z.string().optional(),
  
  // Vault 配置
  VAULT_ID: z.string().optional(),
  TRADER_CAP_ID: z.string().optional(),
  PACKAGE_ID: z.string().optional(),
  
  // 交易配置
  GAS_BUDGET: z.string().default("10000000"),
  TX_TIMEOUT_MS: z.string().default("30000"),
  
  // 网格策略配置
  GRID_LOWER_PRICE: z.string().default("0.5"),
  GRID_UPPER_PRICE: z.string().default("2.0"),
  GRID_LEVELS: z.string().default("10"),
  GRID_AMOUNT_PER_GRID: z.string().default("10"),
  GRID_SLIPPAGE_BPS: z.string().default("50"),
  COIN_TYPE_A: z.string().default("0x2::sui::SUI"),
  COIN_TYPE_B: z.string().default("0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN"), // USDC on testnet
  
  // Bot 运行配置
  TICK_INTERVAL_MS: z.string().default("1000"),
  API_PORT: z.string().default("3215"),
  
  // 数据库配置
  DATABASE_PATH: z.string().default("./gridvault.db"),
})

export type EnvConfig = z.infer<typeof envSchema>

/**
 * 从环境变量加载配置
 */
export function loadEnvConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env)
  
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("\n")
    throw new Error(`Environment validation failed:\n${errors}`)
  }
  
  return result.data
}

/**
 * 构建网格配置
 */
export function buildGridConfig(env: EnvConfig): GridConfig {
  return {
    lowerPrice: parseFloat(env.GRID_LOWER_PRICE),
    upperPrice: parseFloat(env.GRID_UPPER_PRICE),
    levels: parseInt(env.GRID_LEVELS, 10),
    amountPerGrid: parseFloat(env.GRID_AMOUNT_PER_GRID),
    slippageBps: parseInt(env.GRID_SLIPPAGE_BPS, 10),
    coinTypeA: env.COIN_TYPE_A,
    coinTypeB: env.COIN_TYPE_B,
  }
}

/**
 * 构建执行器配置
 */
export function buildExecutorConfig(env: EnvConfig): ExecutorConfig {
  const privateKey = env.SUI_PRIVATE_KEY
  
  if (!privateKey) {
    throw new Error("SUI_PRIVATE_KEY must be set in environment")
  }
  
  // 使用默认 RPC URL（根据网络类型）
  const rpcUrl = env.SUI_RPC_URL ?? getDefaultRpcUrl(env.SUI_NETWORK)
  
  return {
    privateKey,
    rpcUrl,
    network: env.SUI_NETWORK,
    vaultId: env.VAULT_ID ?? "",
    traderCapId: env.TRADER_CAP_ID ?? "",
    packageId: env.PACKAGE_ID ?? "",
    gasBudget: parseInt(env.GAS_BUDGET, 10),
    txTimeoutMs: parseInt(env.TX_TIMEOUT_MS, 10),
    coinTypeA: env.COIN_TYPE_A,
    coinTypeB: env.COIN_TYPE_B,
    slippageBps: parseInt(env.GRID_SLIPPAGE_BPS, 10),
  }
}

/**
 * 获取默认 RPC URL
 */
function getDefaultRpcUrl(network: string): string {
  switch (network) {
    case "testnet":
      return "https://fullnode.testnet.sui.io:443"
    case "mainnet":
      return "https://fullnode.mainnet.sui.io:443"
    case "localnet":
      return "http://127.0.0.1:9000"
    default:
      return "https://fullnode.testnet.sui.io:443"
  }
}

/**
 * Bot 运行配置
 */
export interface BotRuntimeConfig {
  tickIntervalMs: number
  apiPort: number
  databasePath: string
}

/**
 * 构建运行配置
 */
export function buildRuntimeConfig(env: EnvConfig): BotRuntimeConfig {
  return {
    tickIntervalMs: parseInt(env.TICK_INTERVAL_MS, 10),
    apiPort: parseInt(env.API_PORT, 10),
    databasePath: env.DATABASE_PATH,
  }
}

/**
 * 配置管理器
 */
export class ConfigManager {
  private env: EnvConfig
  private gridConfig: GridConfig
  private executorConfig: ExecutorConfig
  private runtimeConfig: BotRuntimeConfig
  
  constructor() {
    this.env = loadEnvConfig()
    this.gridConfig = buildGridConfig(this.env)
    this.executorConfig = buildExecutorConfig(this.env)
    this.runtimeConfig = buildRuntimeConfig(this.env)
  }
  
  getEnv(): EnvConfig {
    return this.env
  }
  
  getGridConfig(): GridConfig {
    return { ...this.gridConfig }
  }
  
  updateGridConfig(updates: Partial<GridConfig>): void {
    this.gridConfig = { ...this.gridConfig, ...updates }
  }
  
  getExecutorConfig(): ExecutorConfig {
    return { ...this.executorConfig }
  }
  
  getRuntimeConfig(): BotRuntimeConfig {
    return { ...this.runtimeConfig }
  }
  
  /**
   * 验证必要配置是否完整
   */
  validateForTrading(): { valid: boolean; missing: string[] } {
    const missing: string[] = []
    
    if (!this.executorConfig.vaultId) missing.push("VAULT_ID")
    if (!this.executorConfig.traderCapId) missing.push("TRADER_CAP_ID")
    if (!this.executorConfig.packageId) missing.push("PACKAGE_ID")
    
    return {
      valid: missing.length === 0,
      missing,
    }
  }
}
