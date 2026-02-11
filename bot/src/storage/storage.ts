/**
 * SQLite 存储模块 (使用 better-sqlite3)
 * 
 * 负责：
 * 1. 网格状态持久化
 * 2. 交易历史记录
 * 3. 配置持久化
 */

import Database from "better-sqlite3"
import type { Database as DatabaseType } from "better-sqlite3"
import type { GridState, GridConfig, TradeRecord, PersistedState } from "../types/index.js"

export interface StorageConfig {
  databasePath: string
}

/**
 * SQLite 存储实现
 */
export class Storage {
  private db: DatabaseType | null = null
  private config: StorageConfig
  
  constructor(config: StorageConfig) {
    this.config = config
  }
  
  /**
   * 初始化数据库连接和表结构
   */
  async init(): Promise<void> {
    this.db = new Database(this.config.databasePath)
    
    // 启用 WAL 模式提高性能
    this.db.pragma("journal_mode = WAL")
    
    this.createTables()
  }
  
  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
  
  /**
   * 创建表结构
   */
  private createTables(): void {
    if (!this.db) throw new Error("Database not initialized")
    
    // 状态表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS state (
        vault_id TEXT PRIMARY KEY,
        last_band INTEGER,
        in_flight INTEGER NOT NULL DEFAULT 0,
        last_trade_time INTEGER,
        config_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
    
    // 交易记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        digest TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        side TEXT NOT NULL,
        amount_in TEXT NOT NULL,
        amount_out TEXT NOT NULL,
        price REAL NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )
    `)
    
    // 日志表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT
      )
    `)
    
    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_trades_digest ON trades(digest);
      CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
    `)
  }
  
  /**
   * 保存网格状态
   */
  async saveState(state: PersistedState): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")
    
    const { vaultId, gridState, config, updatedAt } = state
    
    const stmt = this.db.prepare(`
      INSERT INTO state (vault_id, last_band, in_flight, last_trade_time, config_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(vault_id) DO UPDATE SET
        last_band = excluded.last_band,
        in_flight = excluded.in_flight,
        last_trade_time = excluded.last_trade_time,
        config_json = excluded.config_json,
        updated_at = excluded.updated_at
    `)
    
    stmt.run(
      vaultId,
      gridState.lastBand,
      gridState.inFlight ? 1 : 0,
      gridState.lastTradeTime,
      JSON.stringify(config),
      updatedAt
    )
  }
  
  /**
   * 加载网格状态
   */
  async loadState(vaultId: string): Promise<PersistedState | null> {
    if (!this.db) throw new Error("Database not initialized")
    
    const stmt = this.db.prepare(`
      SELECT last_band, in_flight, last_trade_time, config_json, updated_at
      FROM state WHERE vault_id = ?
    `)
    
    const row = stmt.get(vaultId) as {
      last_band: number | null
      in_flight: number
      last_trade_time: number | null
      config_json: string
      updated_at: number
    } | undefined
    
    if (!row) return null
    
    return {
      vaultId,
      gridState: {
        lastBand: row.last_band,
        inFlight: row.in_flight === 1,
        lastTradeTime: row.last_trade_time,
      },
      config: JSON.parse(row.config_json) as GridConfig,
      updatedAt: row.updated_at,
    }
  }
  
  /**
   * 保存交易记录
   */
  async saveTrade(record: TradeRecord): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")
    
    const stmt = this.db.prepare(`
      INSERT INTO trades (id, digest, timestamp, side, amount_in, amount_out, price, status, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    stmt.run(
      record.id,
      record.digest,
      record.timestamp,
      record.side,
      record.amountIn,
      record.amountOut,
      record.price,
      record.status,
      record.error ?? null
    )
  }
  
  /**
   * 获取交易历史
   */
  async getTrades(options?: {
    limit?: number
    offset?: number
    startTime?: number
    endTime?: number
  }): Promise<TradeRecord[]> {
    if (!this.db) throw new Error("Database not initialized")
    
    let sql = `SELECT * FROM trades WHERE 1=1`
    const params: any[] = []
    
    if (options?.startTime) {
      sql += ` AND timestamp >= ?`
      params.push(options.startTime)
    }
    
    if (options?.endTime) {
      sql += ` AND timestamp <= ?`
      params.push(options.endTime)
    }
    
    sql += ` ORDER BY timestamp DESC`
    
    if (options?.limit) {
      sql += ` LIMIT ?`
      params.push(options.limit)
    }
    
    if (options?.offset) {
      sql += ` OFFSET ?`
      params.push(options.offset)
    }
    
    const stmt = this.db.prepare(sql)
    const rows = stmt.all(...params) as Array<{
      id: string
      digest: string
      timestamp: number
      side: "A2B" | "B2A"
      amount_in: string
      amount_out: string
      price: number
      status: "success" | "failure"
      error?: string
    }>
    
    return rows.map(row => ({
      id: row.id,
      digest: row.digest,
      timestamp: row.timestamp,
      side: row.side,
      amountIn: row.amount_in,
      amountOut: row.amount_out,
      price: row.price,
      status: row.status,
      error: row.error,
    }))
  }
  
  /**
   * 获取交易统计
   */
  async getTradeStats(options?: {
    startTime?: number
    endTime?: number
  }): Promise<{
    totalTrades: number
    successfulTrades: number
    failedTrades: number
    totalVolumeA: bigint
    totalVolumeB: bigint
  }> {
    if (!this.db) throw new Error("Database not initialized")
    
    let sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN side = 'A2B' AND status = 'success' THEN CAST(amount_in AS INTEGER) ELSE 0 END) as volume_a,
        SUM(CASE WHEN side = 'B2A' AND status = 'success' THEN CAST(amount_out AS INTEGER) ELSE 0 END) as volume_b
      FROM trades WHERE 1=1
    `
    
    const params: any[] = []
    
    if (options?.startTime) {
      sql += ` AND timestamp >= ?`
      params.push(options.startTime)
    }
    
    if (options?.endTime) {
      sql += ` AND timestamp <= ?`
      params.push(options.endTime)
    }
    
    const stmt = this.db.prepare(sql)
    const row = stmt.get(...params) as {
      total: number
      successful: number
      failed: number
      volume_a: string
      volume_b: string
    } | undefined
    
    return {
      totalTrades: row?.total ?? 0,
      successfulTrades: row?.successful ?? 0,
      failedTrades: row?.failed ?? 0,
      totalVolumeA: BigInt(row?.volume_a ?? 0),
      totalVolumeB: BigInt(row?.volume_b ?? 0),
    }
  }
  
  /**
   * 写入日志
   */
  async writeLog(level: string, message: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")
    
    const stmt = this.db.prepare(`
      INSERT INTO logs (timestamp, level, message, metadata)
      VALUES (?, ?, ?, ?)
    `)
    
    stmt.run(Date.now(), level, message, metadata ? JSON.stringify(metadata) : null)
  }
  
  /**
   * 获取日志
   */
  async getLogs(options?: {
    limit?: number
    level?: string
    startTime?: number
    endTime?: number
  }): Promise<Array<{
    id: number
    timestamp: number
    level: string
    message: string
    metadata?: Record<string, any>
  }>> {
    if (!this.db) throw new Error("Database not initialized")
    
    let sql = `SELECT * FROM logs WHERE 1=1`
    const params: any[] = []
    
    if (options?.level) {
      sql += ` AND level = ?`
      params.push(options.level)
    }
    
    if (options?.startTime) {
      sql += ` AND timestamp >= ?`
      params.push(options.startTime)
    }
    
    if (options?.endTime) {
      sql += ` AND timestamp <= ?`
      params.push(options.endTime)
    }
    
    sql += ` ORDER BY timestamp DESC`
    
    if (options?.limit) {
      sql += ` LIMIT ?`
      params.push(options.limit)
    }
    
    const stmt = this.db.prepare(sql)
    const rows = stmt.all(...params) as Array<{
      id: number
      timestamp: number
      level: string
      message: string
      metadata: string | null
    }>
    
    return rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      level: row.level,
      message: row.message,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }))
  }
}
