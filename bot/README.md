# GridVault Bot

Sui 网格交易机器人后端服务。

## 功能

- 📊 网格交易策略执行
- 💰 Cetus Aggregator 集成
- 💾 SQLite 状态持久化
- 🔔 HTTP API 控制接口
- 🔐 私钥安全存储

## 技术栈

- **运行时**: Node.js + TypeScript
- **链交互**: @mysten/sui v1.15.1
- **DEX 聚合**: Cetus Aggregator SDK
- **数据库**: better-sqlite3
- **配置**: dotenv + zod 验证

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 网络配置
SUI_NETWORK=testnet

# 私钥（suiprivkey1 格式）
SUI_PRIVATE_KEY=0x...

# 合约配置（部署后填入）
PACKAGE_ID=0x...
VAULT_ID=0x...
TRADER_CAP_ID=0x...

# 网格策略配置
GRID_LOWER_PRICE=0.5
GRID_UPPER_PRICE=2.0
GRID_LEVELS=10
GRID_AMOUNT_PER_GRID=10
GRID_SLIPPAGE_BPS=50

# 交易对代币
COIN_TYPE_A=0x2::sui::SUI
COIN_TYPE_B=0x59a0dfe909f6fbc4f40143d91ca8f96de8e09da3e96a167aa0e0ef9f88065dbc::coinflipcontract::COINFLIPCONTRACT


# API 端口
API_PORT=3215
```

### 运行

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
node dist/index.js
```

## 项目结构

```
bot/
├── src/
│   ├── index.ts           # 入口文件
│   ├── config.ts          # 配置管理
│   ├── strategy/
│   │   └── grid.ts        # 网格策略
│   ├── quote/
│   │   └── aggregator.ts  # Cetus 报价
│   ├── executor/
│   │   └── vault.ts       # Vault 交易执行
│   ├── storage/
│   │   └── db.ts          # SQLite 数据库
│   └── api/
│       └── server.ts      # HTTP API
├── test/                  # 集成测试
│   ├── config.ts
│   ├── ContractTester.ts
│   ├── vault-tests.ts
│   ├── deposit-tests.ts
│   ├── permission-tests.ts
│   └── run-tests.ts
├── .env                   # 环境变量
├── .env.example           # 环境变量示例
└── package.json
```

## API 接口

启动后访问 `http://localhost:3215`

### 获取状态
```bash
GET /status
```

### 获取配置
```bash
GET /config
```

### 更新配置
```bash
POST /config
Content-Type: application/json

{
  "lowerPrice": 0.5,
  "upperPrice": 2.0,
  "levels": 10
}
```

### 控制 Bot
```bash
POST /control
Content-Type: application/json

{ "command": "start" | "stop" }
```

### 获取交易历史
```bash
GET /history?limit=100
```

## 运行测试

```bash
# 运行所有合约集成测试
npx tsx test/run-tests.ts

# 运行单个测试
npx tsx test/vault-tests.ts
npx tsx test/deposit-tests.ts
npx tsx test/permission-tests.ts
```

## 网格策略说明

网格交易策略在价格区间内设置多个档位：

- **价格区间**: [lowerPrice, upperPrice]
- **网格层数**: levels
- **每格金额**: amountPerGrid
- **滑点容忍**: slippageBps

当价格下跌触及下一档位时买入，上涨触及上一档位时卖出。

## 完整交易流程

### 架构概览

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Scheduler  │────▶│   Strategy  │────▶│   Executor  │────▶│    Sui      │
│  (定时触发)  │     │  (网格决策)  │     │ (执行交易)   │     │  (链上)     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                                           
                           ▼                                           
                    ┌─────────────┐                                    
                    │Cetus Price  │                                    
                    └─────────────┘                                    
```
```
Bot Scheduler
      │
      ▼
  获取 Cetus 价格 ──────────────────────────────┐
      │                                         │
      ▼                                         │
  网格策略评估                                   │
      │                                         │
      ├── 价格在上一个网格带上方 ──▶ SELL_A      │
      │                                         │
      └── 价格在下一个网格带下方 ──▶ BUY_A       │
                      │                         │
                      ▼                         │
              获取 Cetus Aggregator             │
              Swap 报价（路由+预估输出）          │
                      │                         │
                      ▼                         │
              构建 PTB（4 步原子操作）            │
                      │                         │
                      ├── 1. trader_withdraw_*  │ 从 Vault 提取
                      ├── 2. routerSwap         │ Cetus 兑换
                      ├── 3. trader_deposit_*   │ 存回 Vault
                      └── 4. trader_swap_*_to_* │ 记录交易
                                      │         │
                                      ▼         │
                              签名并提交交易 ◀───┘
                                      │
                                      ▼
                              等待链上确认
                                      │
                                      ▼
                              更新本地状态（band位置）
```

### 1. 调度器 (Scheduler)

定时循环执行：

```typescript
while (running) {
  // 1. 获取 Cetus 当前价格
  const price = await priceFeed.getPrice()
  
  // 2. 策略决策
  const decision = strategy.evaluate(price)
  
  // 3. 执行交易（如果有信号）
  if (decision.action !== 'HOLD') {
    await executor.executeTrade(decision)
  }
  
  // 4. 等待下一轮
  await sleep(tradeIntervalMs)
}
```

### 2. 网格策略 (Grid Strategy)

**价格带计算**：

```typescript
const bandSize = (upperPrice - lowerPrice) / levels
const currentBand = Math.floor((price - lowerPrice) / bandSize)
```

**交易信号判断**：

| 条件 | 信号 | 操作 |
|------|------|------|
| `band > lastBand` | SELL_A | 价格突破上边界，卖出 A 代币 |
| `band < lastBand` | BUY_A | 价格跌破下边界，买入 A 代币 |
| `band == lastBand` | HOLD | 保持，无操作 |

**买卖决策**：
- **SELL**: 从 Vault 提取 A → Cetus Swap → 存回 B → 记录交易
- **BUY**: 从 Vault 提取 B → Cetus Swap → 存回 A → 记录交易

### 3. 执行器 (Executor)

#### 核心：Programmable Transaction Block (PTB)

Bot 使用 Sui PTB 将多个操作原子化执行，确保资金安全。

#### SELL A → B 流程

```typescript
const tx = new Transaction()

// Step 1: Trader 从 Vault 提取 A 代币
tx.moveCall({
  target: `${packageId}::grid_vault::trader_withdraw_a`,
  arguments: [
    tx.object(vaultId),        // Vault 对象
    tx.object(traderCapId),    // TraderCap 权限
    tx.pure.u64(amountIn),     // 提取金额
  ],
})
// 返回: coinA (Coin<A>)

// Step 2: 通过 Cetus Aggregator 兑换
const coinB = await aggregator.routerSwap({
  router: quote.route,        // Cetus 路由
  inputCoin: coinA,           // 输入代币
  slippage: 0.005,            // 滑点容忍
  txb: tx,                    // PTB 实例
})
// 返回: coinB (Coin<B>)

// Step 3: 将 B 代币存回 Vault
tx.moveCall({
  target: `${packageId}::grid_vault::trader_deposit_b`,
  arguments: [
    tx.object(vaultId),
    tx.object(traderCapId),
    coinB,                     // 兑换后的代币
  ],
})

// Step 4: 记录交易（触发链上事件）
tx.moveCall({
  target: `${packageId}::grid_vault::trader_swap_a_to_b`,
  arguments: [
    tx.object(vaultId),
    tx.object(traderCapId),
    tx.pure.u64(amountIn),     // 输入金额
    tx.pure.u64(minOut),       // 最小输出（滑点保护）
  ],
})

// 提交交易
const result = await client.signAndExecuteTransaction({
  signer: keypair,
  transaction: tx,
})
```

#### BUY A (B → A) 流程

类似 SELL 流程，使用对应函数：
- `trader_withdraw_b`
- `routerSwap` (反向)
- `trader_deposit_a`
- `trader_swap_b_to_a`

### 4. 链上事件处理

交易成功后，Bot 解析链上事件获取实际成交数据：

```typescript
const txDetails = await client.getTransactionBlock({
  digest: result.digest,
  options: { showEvents: true },
})

// 查找 TradeEvent
const tradeEvent = txDetails.events?.find((e) => isTradeEvent(e))
if (tradeEvent) {
  const amountOut = BigInt(tradeEvent.parsedJson.amount_out)
  const price = Number(tradeEvent.parsedJson.price) / 1e9
  // 记录到数据库
}
```

**TradeEvent 结构**：
```move
struct TradeEvent has copy, drop {
  vault_id: ID,
  trader: address,
  is_a_to_b: bool,        // true = A→B, false = B→A
  amount_in: u64,
  amount_out: u64,
  price: u64,
  timestamp: u64,
}
```

### 5. 状态管理

**持久化存储 (SQLite)**：
- `grid_state`: 当前网格档位、上次交易时间
- `trades`: 完整交易历史
- `logs`: 运行日志

**内存状态**：
- `inFlight`: 是否有交易在进行中（防止并发）
- `lastBand`: 上次交易的网格档位

### 安全设计

| 层级 | 机制 | 说明 |
|------|------|------|
| **合约层** | `TraderCap` | 只有持有 TraderCap 才能调用 trader 函数 |
| **资金层** | 强制存回 | Trader 提取后必须通过 deposit 还回，无法直接转走 |
| **滑点保护** | `minOut` | 链上验证实际输出 ≥ 最小预期 |
| **暂停机制** | `paused` | Owner 可随时暂停，阻止所有交易 |
| **并发控制** | `inFlight` | Bot 层确保同一时刻只有一个交易 |

## 注意事项

1. **私钥安全**: `.env` 文件包含敏感信息，不要提交到 Git
2. **Gas 费用**: 确保账户有足够 SUI 支付交易费用
3. **Vault 权限**: Bot 需要持有 TraderCap 才能执行交易
4. **并发控制**: 同一时间只允许一个交易在进行中

## 相关链接

- [前端](../frontend/) - Next.js 管理面板
- [合约](../contracts/) - Move 智能合约
