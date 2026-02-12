import { describe, expect, test } from "vitest"

import { GridStrategy, computeBand, computeGridLines, decideGridAction } from "../src/strategy/grid.js"

describe("grid strategy", () => {
  test("computeGridLines returns levels+1 sorted points", () => {
    const lines = computeGridLines({ lowerPrice: 90, upperPrice: 110, levels: 4 })
    expect(lines).toEqual([90, 95, 100, 105, 110])
  })

  test("computeBand clamps within range", () => {
    const lines = computeGridLines({ lowerPrice: 90, upperPrice: 110, levels: 4 })

    expect(computeBand(lines, 89.99)).toBe(0)
    expect(computeBand(lines, 90)).toBe(0)
    expect(computeBand(lines, 94.999)).toBe(0)

    expect(computeBand(lines, 95)).toBe(1)
    expect(computeBand(lines, 109.999)).toBe(3)
    expect(computeBand(lines, 110)).toBe(3)
    expect(computeBand(lines, 999)).toBe(3)
  })

  test("decideGridAction initializes without trading", () => {
    const config = { lowerPrice: 90, upperPrice: 110, levels: 4, amountPerGrid: 10, slippageBps: 50 }
    const state = { lastBand: null as number | null, inFlight: false, lastTradeTime: null }

    const r1 = decideGridAction(config, state, 100)
    expect(r1.action.type).toBe("NONE")
    expect(r1.nextState.lastBand).toBe(2)
  })

  test("decideGridAction returns SELL when price moves up", () => {
    const config = { lowerPrice: 90, upperPrice: 110, levels: 4, amountPerGrid: 10, slippageBps: 50 }

    const state = { lastBand: 1, inFlight: false, lastTradeTime: null }
    const r = decideGridAction(config, state, 106)

    expect(r.action.type).toBe("SELL")
    expect(r.action.gridSteps).toBe(2)
    // 触发价取首次被跨越的边界
    expect(r.action.triggerPrice).toBe(100)
    // 状态直接同步到当前档位，避免同一价格重复触发
    expect(r.nextState.lastBand).toBe(3)
  })

  test("decideGridAction returns BUY when price moves down", () => {
    const config = { lowerPrice: 90, upperPrice: 110, levels: 4, amountPerGrid: 10, slippageBps: 50 }

    const state = { lastBand: 2, inFlight: false, lastTradeTime: null }
    const r = decideGridAction(config, state, 94)

    expect(r.action.type).toBe("BUY")
    expect(r.action.gridSteps).toBe(2)
    expect(r.action.triggerPrice).toBe(100)
    expect(r.nextState.lastBand).toBe(0)
  })

  test("decideGridAction does nothing when inFlight", () => {
    const config = { lowerPrice: 90, upperPrice: 110, levels: 4, amountPerGrid: 10, slippageBps: 50 }

    const state = { lastBand: 1, inFlight: true, lastTradeTime: null }
    const r = decideGridAction(config, state, 106)

    expect(r.action.type).toBe("NONE")
    expect(r.nextState).toEqual(state)
  })
})

describe("GridStrategy class", () => {
  const baseConfig = {
    lowerPrice: 100,
    upperPrice: 200,
    levels: 10,
    amountPerGrid: 100,
    slippageBps: 50,
    coinTypeA: "0x2::sui::SUI",
    coinTypeB: "0xUSDC::coin::COIN",
  }

  test("constructor initializes with default state", () => {
    const strategy = new GridStrategy(baseConfig)
    const state = strategy.getState()
    
    expect(state.lastBand).toBeNull()
    expect(state.inFlight).toBe(false)
    expect(state.lastTradeTime).toBeNull()
  })

  test("constructor loads initial state", () => {
    const initialState = { lastBand: 5, inFlight: false, lastTradeTime: Date.now() }
    const strategy = new GridStrategy(baseConfig, initialState)
    
    expect(strategy.getState()).toEqual(initialState)
  })

  test("decide returns correct action and updates state", () => {
    const strategy = new GridStrategy(baseConfig)
    
    // First call initializes
    const r1 = strategy.decide(150)
    expect(r1.action.type).toBe("NONE")
    expect(r1.nextState.lastBand).toBe(5)
    
    strategy.updateState(r1.nextState)
    
    // Price moves up
    const r2 = strategy.decide(170)
    expect(r2.action.type).toBe("SELL")
    expect(r2.action.gridSteps).toBe(2)
    expect(r2.nextState.lastBand).toBe(7)
  })

  test("getGridLines returns correct number of lines", () => {
    const strategy = new GridStrategy(baseConfig)
    const lines = strategy.getGridLines()
    
    expect(lines.length).toBe(baseConfig.levels + 1)
    expect(lines[0]).toBe(baseConfig.lowerPrice)
    expect(lines[lines.length - 1]).toBe(baseConfig.upperPrice)
  })

  test("updateConfig merges new values", () => {
    const strategy = new GridStrategy(baseConfig)
    strategy.updateConfig({ levels: 20 })
    
    expect(strategy.getConfig().levels).toBe(20)
    expect(strategy.getConfig().lowerPrice).toBe(baseConfig.lowerPrice)
  })

  test("markTradeComplete updates inFlight", () => {
    const strategy = new GridStrategy(baseConfig)
    
    // Simulate a trade in flight
    strategy.updateState({ lastBand: 3, inFlight: true, lastTradeTime: null })
    
    strategy.markTradeComplete(true)
    
    expect(strategy.getState().inFlight).toBe(false)
    expect(strategy.getState().lastTradeTime).not.toBeNull()
  })
})
