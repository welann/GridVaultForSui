/**
 * 交易执行器模块
 * 
 * 负责：
 * 1. 构造完整的交易流程（取款 -> Cetus Swap -> 存款）
 * 2. 签名并提交交易
 * 3. 等待交易确认
 * 4. 返回交易回执
 */

import { SuiClient } from "@mysten/sui/client"
import { Transaction } from "@mysten/sui/transactions"
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import type { AggregatorClient } from "@cetusprotocol/aggregator-sdk"
import type {
  ExecutorConfig,
  TradeReceipt,
  QuoteResult,
  GridAction,
} from "../types/index.js"
import { isTradeEvent, getAmountOutFromEvent } from "../types/index.js"

export interface TradeParams {
  action: GridAction
  quote: QuoteResult
}

/**
 * 交易执行器
 */
export class Executor {
  private client: SuiClient
  private keypair: Ed25519Keypair
  private config: ExecutorConfig
  
  constructor(config: ExecutorConfig) {
    this.config = config
    this.client = new SuiClient({ url: config.rpcUrl })
    this.keypair = Ed25519Keypair.fromSecretKey(config.privateKey)
  }
  
  /**
   * 获取 bot 地址
   */
  getAddress(): string {
    return this.keypair.toSuiAddress()
  }
  
  /**
   * 构造并执行交易
   * 
   * 交易流程：
   * SELL (A -> B): 
   *   1. trader_withdraw_a(vault, trader_cap, amount_in) -> coin_a
   *   2. Cetus Aggregator swap coin_a -> coin_b
   *   3. trader_deposit_b(vault, trader_cap, coin_b)
   * 
   * BUY (B -> A):
   *   1. trader_withdraw_b(vault, trader_cap, amount_in) -> coin_b
   *   2. Cetus Aggregator swap coin_b -> coin_a
   *   3. trader_deposit_a(vault, trader_cap, coin_a)
   */
  async executeTrade(
    params: TradeParams,
    aggregator: AggregatorClient
  ): Promise<TradeReceipt> {
    const startTime = Date.now()
    
    try {
      // 构造交易
      const tx = await this.buildTransaction(params, aggregator)
      
      // 签名并执行
      const result = await this.client.signAndExecuteTransaction({
        transaction: tx,
        signer: this.keypair,
        options: {
          showEffects: true,
          showEvents: true,
        },
      })
      const immediateError = extractExecutionError(result.effects)
      
      // 等待交易确认
      const confirmed = await this.waitForConfirmation(result.digest)
      let executionError = immediateError
      if (!confirmed && !executionError) {
        try {
          const txDetails = await this.client.getTransactionBlock({
            digest: result.digest,
            options: { showEffects: true },
          })
          executionError = extractExecutionError(txDetails.effects)
        } catch {
          // 忽略错误，下面会提供兜底错误信息
        }
      }
      if (!confirmed && !executionError) {
        executionError = "Transaction failed or not confirmed within timeout"
      }
      
      // 获取交易详情以提取实际输出金额
      let amountOut = params.quote.estimatedOut
      if (confirmed) {
        try {
          const txDetails = await this.client.getTransactionBlock({
            digest: result.digest,
            options: { showEvents: true },
          })
          // 从事件中提取实际交易金额
          const tradeEvent = txDetails.events?.find(
            (e: unknown) => isTradeEvent(e)
          )
          const extractedAmount = getAmountOutFromEvent(tradeEvent)
          if (extractedAmount !== undefined) {
            amountOut = extractedAmount
          }
        } catch {
          // 忽略错误，使用预估金额
        }
      }
      
      const receipt: TradeReceipt = {
        digest: result.digest,
        status: confirmed ? "success" : "failure",
        events: result.events ?? [],
        timestamp: Date.now(),
        amountOut,
        error: confirmed ? undefined : executionError,
      }
      
      return receipt
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      return {
        digest: "",
        status: "failure",
        events: [],
        timestamp: Date.now(),
        error: errorMessage,
        amountOut: BigInt(0),
      }
    }
  }
  
  /**
   * 构造完整的交易流程
   * 
   * SELL (A -> B): withdraw A -> Cetus swap -> deposit B
   * BUY (B -> A): withdraw B -> Cetus swap -> deposit A
   */
  private async buildTransaction(
    params: TradeParams,
    aggregator: AggregatorClient
  ): Promise<Transaction> {
    const tx = new Transaction()
    tx.setGasBudget(this.config.gasBudget)
    
    const { action, quote } = params
    const coinTypeA = this.config.coinTypeA || "0x2::sui::SUI"
    const coinTypeB = this.config.coinTypeB || "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN"
    
    // Vault 和 TraderCap 对象
    const vaultArg = tx.object(this.config.vaultId)
    const traderCapArg = tx.object(this.config.traderCapId)
    
    if (action.type === "SELL") {
      // ========== SELL: A -> B ==========
      
      // Step 1: 从 Vault 取出 A coin
      const [coinA] = tx.moveCall({
        target: `${this.config.packageId}::grid_vault::trader_withdraw_a`,
        typeArguments: [coinTypeA, coinTypeB],
        arguments: [
          vaultArg,
          traderCapArg,
          tx.pure.u64(Number(quote.amountIn)),
        ],
      })
      
      // Step 2: 使用 Cetus Aggregator 将 A 兑换为 B
      // 获取路由数据
      const routerData = quote.routerData.route
      
      // 调用 Cetus Aggregator 进行 swap
      // 注意：routerSwap 会消耗 inputCoin 并返回 outputCoin
      const coinB = await aggregator.routerSwap({
        txb: tx,
        router: routerData,
        inputCoin: coinA,
        slippage: this.config.slippageBps / 100, // bps to percentage
      })
      
      // Step 3: 将 B coin 存入 Vault
      tx.moveCall({
        target: `${this.config.packageId}::grid_vault::trader_deposit_b`,
        typeArguments: [coinTypeA, coinTypeB],
        arguments: [vaultArg, traderCapArg, coinB],
      })
      
    } else if (action.type === "BUY") {
      // ========== BUY: B -> A ==========
      
      // Step 1: 从 Vault 取出 B coin
      const [coinB] = tx.moveCall({
        target: `${this.config.packageId}::grid_vault::trader_withdraw_b`,
        typeArguments: [coinTypeA, coinTypeB],
        arguments: [
          vaultArg,
          traderCapArg,
          tx.pure.u64(Number(quote.amountIn)),
        ],
      })
      
      // Step 2: 使用 Cetus Aggregator 将 B 兑换为 A
      const routerData = quote.routerData.route
      
      const coinA = await aggregator.routerSwap({
        txb: tx,
        router: routerData,
        inputCoin: coinB,
        slippage: this.config.slippageBps / 100,
      })
      
      // Step 3: 将 A coin 存入 Vault
      tx.moveCall({
        target: `${this.config.packageId}::grid_vault::trader_deposit_a`,
        typeArguments: [coinTypeA, coinTypeB],
        arguments: [vaultArg, traderCapArg, coinA],
      })
      
    } else {
      throw new Error(`Invalid action type: ${action.type}`)
    }
    
    return tx
  }
  
  /**
   * 等待交易确认
   */
  private async waitForConfirmation(digest: string): Promise<boolean> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < this.config.txTimeoutMs) {
      try {
        const txBlock = await this.client.getTransactionBlock({
          digest,
          options: {
            showEffects: true,
          },
        })
        
        const status = txBlock.effects?.status?.status
        
        if (status === "success") {
          return true
        } else if (status === "failure") {
          return false
        }
        // 继续等待...
      } catch {
        // 交易可能还未被索引，继续等待
      }
      
      await sleep(500)
    }
    
    // 超时
    return false
  }
  
  /**
   * 获取 Vault 余额
   */
  async getVaultBalances(): Promise<{ a: bigint; b: bigint }> {
    try {
      const vaultObj = await this.client.getObject({
        id: this.config.vaultId,
        options: {
          showContent: true,
        },
      })
      
      if (vaultObj.data?.content?.dataType !== "moveObject") {
        return { a: BigInt(0), b: BigInt(0) }
      }
      
      const fields = vaultObj.data.content.fields as any
      
      return {
        a: BigInt(fields.balance_a ?? 0),
        b: BigInt(fields.balance_b ?? 0),
      }
    } catch (error) {
      console.error("Failed to get vault balances:", error)
      return { a: BigInt(0), b: BigInt(0) }
    }
  }
  
  /**
   * 查询链上事件
   */
  async queryEvents(eventType: string, limit: number = 10): Promise<any[]> {
    try {
      const events = await this.client.queryEvents({
        query: { MoveEventType: eventType },
        limit,
      })
      
      return events.data
    } catch (error) {
      console.error("Failed to query events:", error)
      return []
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function extractExecutionError(effects: unknown): string | undefined {
  if (!effects || typeof effects !== "object") return undefined

  const status = (effects as { status?: unknown }).status
  if (!status || typeof status !== "object") return undefined

  const parsedStatus = status as { status?: unknown; error?: unknown }
  if (parsedStatus.status !== "failure") return undefined

  if (typeof parsedStatus.error === "string" && parsedStatus.error.length > 0) {
    return parsedStatus.error
  }

  return "On-chain execution failed"
}

/**
 * 创建 Executor 实例
 */
export function createExecutor(config: ExecutorConfig): Executor {
  return new Executor(config)
}
