# GridVault 架构文档

## 项目概述

GridVault 是一个基于 Sui 区块链的网格交易机器人 PoC，采用 TypeScript 全栈技术栈。

## 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端层 (Next.js)                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │   VaultManager   │ │   BotControl    │ │  TradeHistory   │   │
│  │   (Vault 管理)   │ │   (Bot 控制)    │ │   (交易历史)     │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
│                        ↕ HTTP API                               │
└─────────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────────┐
│                        Bot 层 (Node.js)                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    主循环 (index.ts)                     │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │   │
│  │  │  Strategy│ │  Quote  │ │ Executor│ │ Storage │    │   │
│  │  │  网格策略│ │ 报价服务│ │ 交易执行│ │ 数据存储│    │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                        ↕ Sui RPC / Cetus API                   │
└─────────────────────────────────────────────────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────────┐
│                      链上层 (Sui Move)                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Vault 合约                           │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │   │
│  │  │ OwnerCap │ │TraderCap│ │  Vault  │ │ Events  │    │   │
│  │  │ 所有者权限│ │交易者权限│ │ 资金托管│ │ 事件日志│    │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 模块职责

### 1. 链上合约 (Move)

**文件**: `contracts/sources/contracts.move`

| 组件 | 职责 |
|------|------|
| `Vault<A, B>` | 双币种资金托管，shared object |
| `OwnerCap` | 所有者权限，可存取、暂停 |
| `TraderCap` | 交易者权限，可执行交易 |
| `RiskParams` | 风控参数占位（MVP 未启用） |

**核心约束**：
- Bot 无法直接提现，只能通过合约定义的 swap 入口操作
- 所有 swap 输出必须回流到 Vault
- Owner 可随时暂停交易

### 2. 交易机器人 (TypeScript)

**主入口**: `bot/src/index.ts`

#### 2.1 网格策略 (`strategy/grid.ts`)

```typescript
// 核心逻辑
- computeGridLines(): 计算网格线
- computeBand(): 计算当前档位
- decideGridAction(): 网格决策（BUY/SELL/NONE）
```

**策略规则**：
1. 价格区间 [lowerPrice, upperPrice] 等分为 levels 档
2. 价格上升跨越档位 → 卖出（SELL）
3. 价格下降跨越档位 → 买入（BUY）
4. 每次只移动一个档位
5. 单并发交易（in-flight 时不再下单）

#### 2.2 报价服务 (`quote/service.ts`)

集成 Cetus Aggregator SDK：
- `findRouters()`: 查找最优路由
- 价格获取和滑点计算

#### 2.3 交易执行器 (`executor/executor.ts`)

- 构造交易（Transaction PTB）
- 签名与提交
- 等待确认与回执处理

#### 2.4 存储层 (`storage/storage.ts`)

SQLite 持久化：
- 网格状态（state 表）
- 交易历史（trades 表）
- 运行日志（logs 表）

#### 2.5 HTTP API (`api/server.ts`)

| 端点 | 方法 | 功能 |
|------|------|------|
| `/status` | GET | 获取 Bot 状态 |
| `/history` | GET | 获取交易历史 |
| `/config` | GET/POST | 获取/更新配置 |
| `/control` | POST | 控制启停 |
| `/logs` | GET | 获取日志 |

### 3. 前端管理面板 (Next.js)

**主页面**: `frontend/src/app/page.tsx`

#### 3.1 Vault 管理 (`components/VaultManager.tsx`)

- 创建 Vault
- 存入/取出资金
- 转移 TraderCap

#### 3.2 Bot 控制 (`components/BotControl.tsx`)

- 状态监控
- 启停控制
- 网格参数配置

#### 3.3 交易历史 (`components/TradeHistory.tsx`)

- 交易记录列表
- 实时刷新

## 数据流

### 交易执行流程

```
1. 定时 Tick (每秒)
   ↓
2. 获取市场价格 (Cetus Aggregator)
   ↓
3. 网格策略决策
   ├─ 无交易 → 等待下一 tick
   └─ 需交易 → 继续
   ↓
4. 获取报价 (minOut 计算)
   ↓
5. 构造并执行交易
   ↓
6. 等待链上确认
   ↓
7. 保存交易记录到 SQLite
   ↓
8. 更新网格状态
   ↓
9. 等待下一 tick
```

### 配置更新流程

```
前端调用 POST /config
   ↓
Bot 验证参数合法性
   ↓
更新内存中的 GridStrategy
   ↓
持久化到 SQLite
   ↓
返回成功响应
```

## 安全设计

### 1. 权限分离

```
Owner (用户钱包)
  ├─ OwnerCap → 存取资金、暂停
  └─ 可转移 TraderCap 给 Bot

Bot (自动化地址)
  └─ TraderCap → 仅可执行交易
```

### 2. 资金保护

- Vault 是 shared object，但资金只能通过合约定义的路径流转
- Bot 无法直接转出 Vault 资金
- 暂停机制可立即阻止交易

### 3. 风控占位

`RiskParams` 结构预留：
- `max_in_per_trade`: 单笔最大投入
- `cooldown_ms`: 交易冷却时间

MVP 阶段未启用，为后续扩展预留。

## 配置管理

### 环境变量

**Bot** (`.env`):
```
SUI_PRIVATE_KEY      # Bot 私钥
VAULT_ID            # Vault 对象 ID
TRADER_CAP_ID       # TraderCap 对象 ID
PACKAGE_ID          # 合约包 ID
GRID_LOWER_PRICE    # 网格下限
GRID_UPPER_PRICE    # 网格上限
GRID_LEVELS         # 网格层数
```

**前端** (`.env.local`):
```
NEXT_PUBLIC_BOT_API_URL    # Bot API 地址
NEXT_PUBLIC_PACKAGE_ID     # 合约包 ID
```

## 部署架构

### 本地开发

```
终端1: sui start --force-regenesis --with-faucet  # 本地链
终端2: cd bot && npm run dev                       # Bot
终端3: cd frontend && npm run dev                  # 前端
```

### Testnet 部署

1. 部署合约获取 PackageId
2. 前端创建 Vault 获取 VaultId
3. 存入资金并转移 TraderCap
4. 配置 Bot 环境变量启动

## 扩展性设计

### 1. 策略扩展

`GridStrategy` 类可扩展为：
- 动态网格策略
- 马丁格尔策略
- 自定义策略

### 2. DEX 扩展

`QuoteService` 支持接入多个 DEX：
- Cetus (已实现)
- Turbos
- DeepBook

### 3. 风控扩展

预留 `RiskParams` 结构，可添加：
- 日交易量限制
- 价格波动熔断
- 允许 DEX 白名单

## 测试策略

### 单元测试

- Move: `sui move test`
- Bot: `vitest run`

### E2E 测试

```bash
# 1. 启动 localnet
sui start --force-regenesis --with-faucet

# 2. 部署合约
sui client publish

# 3. 运行完整流程
# - 创建 Vault
# - 存入资金
# - 启动 Bot
# - 验证交易
```

## 监控与日志

### Bot 日志

```
[tick] Price: 1.234500, Band: 5
[tick] Action: SELL, Trigger: 1.200000
[tick] Quote: in=1000000000, est=833333333, min=829166666
[tick] ✅ Trade executed: 0xabc...
```

### API 监控

- `/status`: 实时状态查询
- `/logs`: 日志检索
- SQLite: 历史数据分析
