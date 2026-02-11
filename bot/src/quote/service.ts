/**
 * 报价服务模块
 * 
 * 集成 Cetus Aggregator SDK 获取最优交易路由和价格
 */

import { AggregatorClient, Env } from "@cetusprotocol/aggregator-sdk"
import { SuiClient } from "@mysten/sui/client"
import type { QuoteResult, RouterData, GridConfig } from "../types/index.js"

export interface QuoteServiceConfig {
  rpcUrl: string
  /** Cetus Aggregator API 端点 */
  aggregatorApiUrl?: string
  /** 链类型 */
  network: "mainnet" | "testnet"
}

/**
 * 报价服务
 */
export class QuoteService {
  private client: SuiClient
  private aggregator: AggregatorClient
  private config: QuoteServiceConfig
  
  constructor(config: QuoteServiceConfig) {
    this.config = config
    this.client = new SuiClient({ url: config.rpcUrl })
    this.aggregator = new AggregatorClient({
      endpoint: config.aggregatorApiUrl ?? this.getDefaultAggregatorUrl(config.network),
      client: this.client,
      env: config.network === "mainnet" ? Env.Mainnet : Env.Testnet,
    })
  }
  
  /**
   * 获取默认 Aggregator API URL
   */
  private getDefaultAggregatorUrl(network: string): string {
    // Cetus Aggregator API 端点
    if (network === "mainnet") {
      return "https://api-sui.cetus.zone/router"
    }
    return "https://api-sui-testnet.cetus.zone/router"
  }
  
  /**
   * 获取 A -> B 的报价
   * @param amountIn 输入金额（以 A 的最小单位）
   * @param slippageBps 滑点容忍度（bps）
   */
  async getQuoteA2B(
    coinTypeA: string,
    coinTypeB: string,
    amountIn: bigint,
    slippageBps: number
  ): Promise<QuoteResult | null> {
    try {
      // 调用 Cetus Aggregator 查找最优路由
      const routers = await this.aggregator.findRouters({
        from: coinTypeA,
        target: coinTypeB,
        amount: amountIn.toString(),
        byAmountIn: true,
      })
      
      if (!routers) {
        return null
      }
      
      const bestRoute = routers
      const estimatedOut = BigInt(bestRoute.amountOut.toString())
      
      // 计算最小输出（考虑滑点）
      const minOut = this.computeMinOut(estimatedOut, slippageBps)
      
      // 计算价格（estimatedOut / amountIn）
      const price = Number(estimatedOut) / Number(amountIn)
      
      return {
        side: "A2B",
        amountIn,
        estimatedOut,
        minOut,
        routerData: {
          route: bestRoute,
          estimatedOut,
          priceImpact: 0, // RouterDataV3 没有直接提供 priceImpact
        },
        price,
      }
    } catch (error) {
      console.error("Failed to get quote A2B:", error)
      return null
    }
  }
  
  /**
   * 获取 B -> A 的报价
   * @param amountIn 输入金额（以 B 的最小单位）
   * @param slippageBps 滑点容忍度（bps）
   */
  async getQuoteB2A(
    coinTypeA: string,
    coinTypeB: string,
    amountIn: bigint,
    slippageBps: number
  ): Promise<QuoteResult | null> {
    try {
      // 调用 Cetus Aggregator 查找最优路由
      const routers = await this.aggregator.findRouters({
        from: coinTypeB,
        target: coinTypeA,
        amount: amountIn.toString(),
        byAmountIn: true,
      })
      
      if (!routers) {
        return null
      }
      
      const bestRoute = routers
      const estimatedOut = BigInt(bestRoute.amountOut.toString())
      
      // 计算最小输出（考虑滑点）
      const minOut = this.computeMinOut(estimatedOut, slippageBps)
      
      // 计算价格（amountIn / estimatedOut）
      const price = Number(amountIn) / Number(estimatedOut)
      
      return {
        side: "B2A",
        amountIn,
        estimatedOut,
        minOut,
        routerData: {
          route: bestRoute,
          estimatedOut,
          priceImpact: 0, // RouterDataV3 没有直接提供 priceImpact
        },
        price,
      }
    } catch (error) {
      console.error("Failed to get quote B2A:", error)
      return null
    }
  }
  
  /**
   * 获取当前市场价格
   * 通过小额询价来估算当前价格
   */
  async getMarketPrice(
    coinTypeA: string,
    coinTypeB: string
  ): Promise<number | null> {
    try {
      // 使用 1 SUI 作为询价金额（9位小数）
      const testAmount = BigInt(1_000_000_000) // 1 SUI
      
      const quote = await this.getQuoteA2B(coinTypeA, coinTypeB, testAmount, 100)
      if (quote) {
        return quote.price
      }
      
      // 如果 A->B 失败，尝试 B->A 并取倒数
      const quoteB2A = await this.getQuoteB2A(coinTypeA, coinTypeB, testAmount, 100)
      if (quoteB2A) {
        return 1 / quoteB2A.price
      }
      
      return null
    } catch (error) {
      console.error("Failed to get market price:", error)
      return null
    }
  }
  
  /**
   * 计算滑点保护的最小输出
   */
  private computeMinOut(estimatedOut: bigint, slippageBps: number): bigint {
    const multiplier = BigInt(10000 - slippageBps)
    return (estimatedOut * multiplier) / BigInt(10000)
  }
  
  /**
   * 获取 SuiClient 实例（用于其他操作）
   */
  getSuiClient(): SuiClient {
    return this.client
  }
  
  /**
   * 获取 AggregatorClient 实例（用于构造交易）
   */
  getAggregator(): AggregatorClient {
    return this.aggregator
  }
}

/**
 * 创建 QuoteService 实例
 */
export function createQuoteService(config: QuoteServiceConfig): QuoteService {
  return new QuoteService(config)
}
