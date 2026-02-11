/**
 * HTTP API 服务器
 * 
 * 提供：
 * - GET /status - 获取 bot 状态
 * - GET /history - 获取交易历史
 * - GET /config - 获取当前配置
 * - POST /config - 更新配置
 * - POST /control - 控制命令（start/stop/pause/resume）
 * - GET /logs - 获取日志
 */

import http from "http"
import type { Storage } from "../storage/storage.js"
import type { GridStrategy } from "../strategy/grid.js"
import type { ConfigManager } from "../config/config.js"
import type { BotStatus, GridConfig } from "../types/index.js"

export interface ApiServerConfig {
  port: number
}

export interface ApiDependencies {
  storage: Storage
  strategy: GridStrategy
  configManager: ConfigManager
  getStatus: () => BotStatus
  setRunning: (running: boolean) => void
  getMarketPrice: () => Promise<{ price: number | null; timestamp: number | null }>
}

/**
 * API 服务器
 */
export class ApiServer {
  private server: http.Server | null = null
  private config: ApiServerConfig
  private deps: ApiDependencies
  
  constructor(config: ApiServerConfig, deps: ApiDependencies) {
    this.config = config
    this.deps = deps
  }
  
  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res)
    })
    
    return new Promise((resolve, reject) => {
      this.server?.listen(this.config.port, () => {
        console.log(`API server listening on port ${this.config.port}`)
        resolve()
      })
      
      this.server?.on("error", reject)
    })
  }
  
  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server?.close(() => {
        console.log("API server stopped")
        resolve()
      })
    })
  }
  
  /**
   * 处理请求
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")
    
    if (req.method === "OPTIONS") {
      res.writeHead(200)
      res.end()
      return
    }
    
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`)
    const path = url.pathname
    const method = req.method ?? "GET"
    
    try {
      // 路由处理
      if (path === "/status" && method === "GET") {
        await this.handleGetStatus(res)
      } else if (path === "/price" && method === "GET") {
        await this.handleGetPrice(res)
      } else if (path === "/history" && method === "GET") {
        await this.handleGetHistory(url, res)
      } else if (path === "/quotes" && method === "GET") {
        await this.handleGetQuotes(url, res)
      } else if (path === "/config" && method === "GET") {
        await this.handleGetConfig(res)
      } else if (path === "/config" && method === "POST") {
        await this.handlePostConfig(req, res)
      } else if (path === "/control" && method === "POST") {
        await this.handlePostControl(req, res)
      } else if (path === "/logs" && method === "GET") {
        await this.handleGetLogs(url, res)
      } else if (path === "/" && method === "GET") {
        await this.handleRoot(res)
      } else {
        this.sendJson(res, 404, { error: "Not found" })
      }
    } catch (error) {
      console.error("API error:", error)
      this.sendJson(res, 500, { error: "Internal server error" })
    }
  }
  
  /**
   * GET /status
   */
  private async handleGetStatus(res: http.ServerResponse): Promise<void> {
    const status = this.deps.getStatus()
    if (status.lastPrice === null) {
      const priceData = await this.deps.getMarketPrice()
      status.lastPrice = priceData.price
      status.lastPriceAt = priceData.timestamp
    }
    this.sendJson(res, 200, status)
  }

  /**
   * GET /price
   */
  private async handleGetPrice(res: http.ServerResponse): Promise<void> {
    const data = await this.deps.getMarketPrice()
    this.sendJson(res, 200, data)
  }
  
  /**
   * GET /history
   */
  private async handleGetHistory(
    url: URL,
    res: http.ServerResponse
  ): Promise<void> {
    const limit = parseInt(url.searchParams.get("limit") ?? "100", 10)
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10)
    
    const trades = await this.deps.storage.getTrades({ limit, offset })
    this.sendJson(res, 200, { trades })
  }

  /**
   * GET /quotes
   */
  private async handleGetQuotes(
    url: URL,
    res: http.ServerResponse
  ): Promise<void> {
    const limit = parseInt(url.searchParams.get("limit") ?? "200", 10)
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10)
    const sideParam = url.searchParams.get("side") ?? undefined
    const side = sideParam === "A2B" || sideParam === "B2A" ? sideParam : undefined

    const quotes = await this.deps.storage.getQuotes({ limit, offset, side })
    this.sendJson(res, 200, { quotes })
  }
  
  /**
   * GET /config
   */
  private async handleGetConfig(res: http.ServerResponse): Promise<void> {
    const config = this.deps.strategy.getConfig()
    this.sendJson(res, 200, { config })
  }
  
  /**
   * POST /config
   */
  private async handlePostConfig(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const body = await this.readBody(req)
    
    try {
      const updates = JSON.parse(body) as Partial<GridConfig>
      
      // 验证配置
      if (updates.levels !== undefined && (updates.levels < 2 || updates.levels > 100)) {
        this.sendJson(res, 400, { error: "levels must be between 2 and 100" })
        return
      }
      
      if (updates.lowerPrice !== undefined && updates.upperPrice !== undefined) {
        if (updates.lowerPrice >= updates.upperPrice) {
          this.sendJson(res, 400, { error: "lowerPrice must be less than upperPrice" })
          return
        }
      }
      
      this.deps.strategy.updateConfig(updates)
      this.deps.configManager.updateGridConfig(updates)
      
      this.sendJson(res, 200, { success: true, config: this.deps.strategy.getConfig() })
    } catch (error) {
      this.sendJson(res, 400, { error: "Invalid JSON" })
    }
  }
  
  /**
   * POST /control
   */
  private async handlePostControl(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const body = await this.readBody(req)
    
    try {
      const { command } = JSON.parse(body) as { command: string }
      
      switch (command) {
        case "start":
        case "resume":
          this.deps.setRunning(true)
          this.sendJson(res, 200, { success: true, running: true })
          break
        case "stop":
        case "pause":
          this.deps.setRunning(false)
          this.sendJson(res, 200, { success: true, running: false })
          break
        default:
          this.sendJson(res, 400, { error: "Invalid command. Use: start, stop, pause, resume" })
      }
    } catch (error) {
      this.sendJson(res, 400, { error: "Invalid JSON" })
    }
  }
  
  /**
   * GET /logs
   */
  private async handleGetLogs(
    url: URL,
    res: http.ServerResponse
  ): Promise<void> {
    const limit = parseInt(url.searchParams.get("limit") ?? "100", 10)
    const level = url.searchParams.get("level") ?? undefined
    
    const logs = await this.deps.storage.getLogs({ limit, level })
    this.sendJson(res, 200, { logs })
  }
  
  /**
   * GET /
   */
  private async handleRoot(res: http.ServerResponse): Promise<void> {
    this.sendJson(res, 200, {
      name: "GridVault Bot API",
      version: "0.0.1",
      endpoints: [
        { method: "GET", path: "/status", description: "Get bot status" },
        { method: "GET", path: "/price", description: "Get current market price" },
        { method: "GET", path: "/history", description: "Get trade history" },
        { method: "GET", path: "/quotes", description: "Get quote history" },
        { method: "GET", path: "/config", description: "Get grid config" },
        { method: "POST", path: "/config", description: "Update grid config" },
        { method: "POST", path: "/control", description: "Control bot (start/stop/pause/resume)" },
        { method: "GET", path: "/logs", description: "Get logs" },
      ],
    })
  }
  
  /**
   * 发送 JSON 响应
   */
  private sendJson(
    res: http.ServerResponse,
    statusCode: number,
    data: any
  ): void {
    res.writeHead(statusCode, { "Content-Type": "application/json" })
    res.end(JSON.stringify(data, (_, v) => typeof v === "bigint" ? v.toString() : v))
  }
  
  /**
   * 读取请求体
   */
  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = ""
      req.on("data", (chunk) => {
        body += chunk.toString()
      })
      req.on("end", () => {
        resolve(body)
      })
      req.on("error", reject)
    })
  }
}

/**
 * 创建 API 服务器实例
 */
export function createApiServer(
  config: ApiServerConfig,
  deps: ApiDependencies
): ApiServer {
  return new ApiServer(config, deps)
}
