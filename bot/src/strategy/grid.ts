/**
 * 网格交易策略实现
 * 
 * 核心逻辑：
 * 1. 将价格区间 [lowerPrice, upperPrice] 等分为 levels 个档位
 * 2. 价格从低档位跨越到高档位时卖出（SELL）
 * 3. 价格从高档位跨越到低档位时买入（BUY）
 * 4. 每次按跨越档位数触发一次，避免同一价格反复触发同方向订单
 */

import type { GridConfig, GridState, GridDecision, GridAction, MarketSnapshot } from "../types/index.js"

export interface GridLinesResult {
  lines: number[]
  step: number
}

/**
 * 计算网格线
 * 返回 levels+1 个价格点（包含上下边界）
 */
export function computeGridLines(
  config: Pick<GridConfig, "lowerPrice" | "upperPrice" | "levels">
): number[] {
  const { lowerPrice, upperPrice, levels } = config
  const step = (upperPrice - lowerPrice) / levels
  const lines: number[] = []
  
  for (let i = 0; i <= levels; i++) {
    lines.push(lowerPrice + step * i)
  }
  
  return lines
}

/**
 * 根据当前价格计算所在档位
 * @returns 档位索引 [0, levels-1]
 */
export function computeBand(lines: number[], price: number): number {
  const levels = lines.length - 1
  
  // 低于最低价，归为最低档
  if (price <= lines[0]) return 0
  
  // 高于最高价，归为最高档
  if (price >= lines[levels]) return levels - 1
  
  // 二分查找所在档位
  for (let i = 0; i < levels; i++) {
    if (price >= lines[i] && price < lines[i + 1]) {
      return i
    }
  }
  
  return levels - 1
}

/**
 * 计算网格决策
 * 
 * 策略规则：
 * - 首次运行：只记录档位，不交易
 * - 价格上升跨越档位：卖出（SELL）
 * - 价格下降跨越档位：买入（BUY）
 * - 价格一次跨越多个档位时，按跨越层数合并为一笔交易
 * - 有 in-flight 交易时不做新决策
 */
export function decideGridAction(
  config: Pick<GridConfig, "lowerPrice" | "upperPrice" | "levels" | "amountPerGrid" | "slippageBps">,
  state: GridState,
  price: number
): GridDecision {
  const lines = computeGridLines(config)
  const currentBand = computeBand(lines, price)
  
  // 如果有正在执行的交易，不做新决策
  if (state.inFlight) {
    return {
      action: { type: "NONE" },
      nextState: state,
    }
  }
  
  // 首次初始化：记录档位，不交易
  if (state.lastBand === null) {
    return {
      action: { type: "NONE" },
      nextState: {
        ...state,
        lastBand: currentBand,
      },
    }
  }
  
  // 档位未变化：不交易
  if (currentBand === state.lastBand) {
    return {
      action: { type: "NONE" },
      nextState: state,
    }
  }
  
  const bandDelta = currentBand - state.lastBand

  // 价格上升：卖出（A -> B）
  if (currentBand > state.lastBand) {
    const crossedSteps = bandDelta
    const triggerPrice = lines[state.lastBand + 1]
    
    return {
      action: {
        type: "SELL",
        triggerPrice,
        gridSteps: crossedSteps,
        // 具体金额在构造交易时计算
        amountIn: BigInt(Math.floor(config.amountPerGrid * 1e9)), // 暂时用占位值
      },
      nextState: {
        ...state,
        lastBand: currentBand,
        inFlight: true,
      },
    }
  }
  
  // 价格下降：买入（B -> A）
  // currentBand < state.lastBand
  const crossedSteps = Math.abs(bandDelta)
  const triggerPrice = lines[state.lastBand] // 买入以上一档位边界价格触发
  
  return {
    action: {
      type: "BUY",
      triggerPrice,
      gridSteps: crossedSteps,
      amountIn: BigInt(Math.floor(config.amountPerGrid * 1e9)), // 暂时用占位值
    },
    nextState: {
      ...state,
      lastBand: currentBand,
      inFlight: true,
    },
  }
}

/**
 * 计算滑点保护的最小输出金额
 */
export function computeMinOut(
  estimatedOut: bigint,
  slippageBps: number
): bigint {
  // slippageBps = 50 表示 0.5%
  const multiplier = BigInt(10000 - slippageBps)
  return (estimatedOut * multiplier) / BigInt(10000)
}

/**
 * 网格策略主类
 */
export class GridStrategy {
  private config: GridConfig
  private state: GridState
  
  constructor(config: GridConfig, initialState?: GridState) {
    this.config = config
    this.state = initialState ?? {
      lastBand: null,
      inFlight: false,
      lastTradeTime: null,
    }
  }
  
  /**
   * 获取当前状态
   */
  getState(): GridState {
    return { ...this.state }
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<GridConfig>): void {
    this.config = { ...this.config, ...config }
  }
  
  /**
   * 获取配置
   */
  getConfig(): GridConfig {
    return { ...this.config }
  }
  
  /**
   * 根据市场价格做决策
   */
  decide(price: number): GridDecision {
    return decideGridAction(this.config, this.state, price)
  }
  
  /**
   * 更新状态
   */
  updateState(newState: GridState): void {
    this.state = { ...newState }
  }
  
  /**
   * 标记交易完成
   */
  markTradeComplete(success: boolean): void {
    this.state.inFlight = false
    if (success) {
      this.state.lastTradeTime = Date.now()
    }
  }
  
  /**
   * 计算网格线（用于展示）
   */
  getGridLines(): number[] {
    return computeGridLines(this.config)
  }
  
  /**
   * 获取当前档位
   */
  getCurrentBand(price: number): number {
    const lines = this.getGridLines()
    return computeBand(lines, price)
  }
}
