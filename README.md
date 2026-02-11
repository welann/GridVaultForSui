# GridVault

Sui 区块链上的网格交易机器人 PoC。

## 项目结构

```
GridVault/
├── contracts/          # Move 智能合约
│   ├── sources/       # 合约源码 (grid_vault.move)
│   ├── tests/         # Move 单元测试
│   ├── package.json   # TypeScript 测试依赖
│   └── tsconfig.json  # TypeScript 配置
├── bot/               # TypeScript 交易机器人
│   ├── src/           # 源码
│   │   ├── strategy/  # 网格策略
│   │   ├── quote/     # 报价服务
│   │   ├── executor/  # 交易执行
│   │   ├── storage/   # SQLite 存储
│   │   ├── api/       # HTTP API
│   │   └── config/    # 配置管理
│   ├── test/          # 集成测试
│   │   ├── ContractTester.ts    # 合约测试工具
│   │   ├── vault-tests.ts       # Vault 测试
│   │   ├── deposit-tests.ts     # 存取款测试
│   │   ├── permission-tests.ts  # 权限测试
│   │   └── run-tests.ts         # 测试入口
│   ├── .env           # 环境变量
│   └── .env.example   # 环境变量示例
├── frontend/          # Next.js 管理面板
│   ├── src/
│   │   ├── app/       # 页面
│   │   ├── components/# 组件 (WalletApp.tsx)
│   │   └── lib/       # 工具库
│   ├── .env.local     # 环境变量
│   └── README.md      # 前端说明
└── docs/              # 文档
    ├── plan.md        # 项目规划
    └── DEV.md         # 开发指南
```

## 快速开始

### 1. 合约（Move）

```bash
cd contracts

# 运行 Move 单元测试
sui move test

# 构建合约
sui move build

# 部署合约（需要配置私钥）
sui client publish
```

### 2. Bot（TypeScript）

```bash
cd bot
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入必要配置：
# - SUI_PRIVATE_KEY: 私钥
# - PACKAGE_ID: 部署后的合约包 ID
# - VAULT_ID: Vault 对象 ID（可选，首次运行会自动创建）

npm run dev          # 开发模式
```

### 3. 运行合约集成测试

```bash
cd bot

# 运行所有测试
npx tsx test/run-tests.ts

# 运行单个测试
npx tsx test/vault-tests.ts
npx tsx test/deposit-tests.ts
npx tsx test/permission-tests.ts
```

### 4. 前端（Next.js）

```bash
cd frontend
npm install

# 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local 填入：
# - NEXT_PUBLIC_PACKAGE_ID: 合约包 ID
# - NEXT_PUBLIC_BOT_API_URL: Bot API 地址

npm run dev          # 开发模式
```

## 技术栈

- **链上**: Move (Sui)
- **Bot**: Node.js + TypeScript + Cetus Aggregator SDK
- **前端**: Next.js + @mysten/dapp-kit-react
- **存储**: SQLite

## 核心特性

- ✅ 秒级 tick 执行
- ✅ 单并发交易（避免冲突）
- ✅ 网格策略（可配置参数）
- ✅ Cetus Aggregator 集成
- ✅ 完整的事件日志
- ✅ SQLite 状态持久化
- ✅ HTTP API 控制
- ✅ Web 管理面板

## 交易流程

详细交易流程说明：[bot/README.md](./bot/README.md#完整交易流程)

流程概要：
1. **Scheduler** - 定时触发，获取 Cetus 价格
2. **Strategy** - 网格策略判断（价格上涨→卖出，下跌→买入）
3. **Executor** - 构建 PTB（withdraw → swap → deposit → record）
4. **Sui 链上** - 原子化执行交易，触发 TradeEvent

## 安全设计

1. **Vault 资金托管**: 资金存储在链上 Vault，Owner 控制存取
2. **权限分离**: OwnerCap（用户）/ TraderCap（Bot）
3. **暂停机制**: Owner 可随时暂停交易
4. **Bot 无提现**: 合约层禁止 Bot 转出资金

## 开发计划

- [x] M1: 链上合约（Vault + 权限 + 事件）
- [x] M2: Bot 最小闭环（策略 + 执行 + 存储 + API）
- [x] M3: 前端管理面板
- [x] M4: 合约集成测试
- [ ] M5: 风控加固与扩展

## 目录说明

| 目录 | 说明 |
|------|------|
| `contracts/` | Move 智能合约源码和 TypeScript 集成测试 |
| `bot/` | 交易机器人后端服务和测试套件 |
| `frontend/` | Next.js 前端管理面板 |
| `docs/` | 项目文档 |

## 许可证

MIT
