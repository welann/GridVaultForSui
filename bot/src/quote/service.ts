/**
 * 报价服务模块
 * 
 * 集成 Cetus Aggregator SDK 获取最优交易路由和价格
 */

import { AggregatorClient, Env } from "@cetusprotocol/aggregator-sdk"
import { SuiClient } from "@mysten/sui/client"
import BN from "bn.js"
import type { QuoteRecord, QuoteResult } from "../types/index.js"

export interface QuoteServiceConfig {
  rpcUrl: string
  /** Cetus Aggregator API 端点 */
  aggregatorApiUrl?: string
  /** 链类型 */
  network: "mainnet" | "testnet"
  /** 询价结果回调（用于落库或日志） */
  onQuote?: (record: QuoteRecord) => void | Promise<void>
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
    // Cetus Aggregator API v3 端点（文档推荐使用 /router_v3/find_routes）
    if (network === "mainnet") {
      return "https://api-sui.cetus.zone/router_v3/find_routes"
    }
    return "https://api-sui-testnet.cetus.zone/router_v3/find_routes"
  }

  /**
   * 统一的询价入口（固定输入金额）
   */
  private async getQuote(
    side: "A2B" | "B2A",
    from: string,
    target: string,
    amountIn: bigint,
    slippageBps: number
  ): Promise<QuoteResult | null> {
    const timestamp = Date.now()
    const baseRecord: Omit<QuoteRecord, "amountOut" | "minOut" | "price" | "priceImpact" | "status"> = {
      id: this.createQuoteId(timestamp),
      timestamp,
      side,
      fromCoin: from,
      targetCoin: target,
      amountIn: amountIn.toString(),
      byAmountIn: true,
      quoteId: undefined,
    }

    try {
      const amount = new BN(amountIn.toString())

      // 调用 Cetus Aggregator 查找最优路由
      const routerData = await this.aggregator.findRouters({
        from,
        target,
        amount,
        byAmountIn: true,
      })

      if (!routerData) {
        console.error(`[getQuote:${side}] findRouters returned null`)
        await this.recordQuote({
          ...baseRecord,
          amountOut: "0",
          minOut: "0",
          price: null,
          priceImpact: null,
          status: "failure",
          error: "findRouters returned null",
        })
        return null
      }

      if (routerData.error) {
        console.error(`[getQuote:${side}] Router error:`, routerData.error)
        await this.recordQuote({
          ...baseRecord,
          amountOut: "0",
          minOut: "0",
          price: null,
          priceImpact: null,
          status: "failure",
          error: routerData.error.msg ?? "Router error",
        })
        return null
      }

      if (routerData.insufficientLiquidity) {
        console.error(`[getQuote:${side}] Insufficient liquidity`)
        await this.recordQuote({
          ...baseRecord,
          amountOut: "0",
          minOut: "0",
          price: null,
          priceImpact: null,
          status: "failure",
          error: "Insufficient liquidity",
        })
        return null
      }

      const estimatedOut = BigInt(routerData.amountOut.toString())
      const minOut = this.computeMinOut(estimatedOut, slippageBps)

      // 价格 = 输出 / 输入（统一口径）
      const price = this.computePrice(
        routerData.amountIn.toString(),
        routerData.amountOut.toString()
      )

      await this.recordQuote({
        ...baseRecord,
        amountOut: routerData.amountOut.toString(),
        minOut: minOut.toString(),
        price,
        priceImpact: typeof routerData.deviationRatio === "number" ? routerData.deviationRatio : null,
        quoteId: routerData.quoteID,
        status: "success",
      })

      return {
        side,
        amountIn,
        estimatedOut,
        minOut,
        routerData: {
          route: routerData,
          estimatedOut,
          priceImpact: typeof routerData.deviationRatio === "number" ? routerData.deviationRatio : 0,
        },
        price,
      }
    } catch (error) {
      console.error(`[getQuote:${side}] Failed to get quote:`, error)
      console.error("  from:", from)
      console.error("  target:", target)
      console.error("  amountIn:", amountIn.toString())
      await this.recordQuote({
        ...baseRecord,
        amountOut: "0",
        minOut: "0",
        price: null,
        priceImpact: null,
        status: "failure",
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
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
    return this.getQuote("A2B", coinTypeA, coinTypeB, amountIn, slippageBps)
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
    return this.getQuote("B2A", coinTypeB, coinTypeA, amountIn, slippageBps)
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
        return quoteB2A.price === 0 ? null : 1 / quoteB2A.price
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
   * 计算价格（输出/输入）
   */
  private computePrice(amountIn: string, amountOut: string): number {
    const inNum = Number(amountIn)
    const outNum = Number(amountOut)
    if (!Number.isFinite(inNum) || !Number.isFinite(outNum) || inNum === 0) {
      return 0
    }
    return outNum / inNum
  }

  private async recordQuote(record: QuoteRecord): Promise<void> {
    if (!this.config.onQuote) return
    try {
      await this.config.onQuote(record)
    } catch (error) {
      console.error("[QuoteService] Failed to record quote:", error)
    }
  }

  private createQuoteId(timestamp: number): string {
    return `${timestamp}-${Math.random().toString(36).slice(2, 10)}`
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
