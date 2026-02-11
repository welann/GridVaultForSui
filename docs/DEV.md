# 开发指南（GridVault）

> 日期：2026-02-03

本仓库包含完整的 GridVault PoC：
- `contracts/` - Move 合约
- `bot/` - TypeScript 交易机器人
- `frontend/` - Next.js 管理面板

---

## 0. 环境要求

- Sui CLI（建议与链上/活动要求版本保持一致）
  - `sui --version`
  - `sui client envs`
  - `sui client addresses`

- Node.js 18+
  - `node --version`
  - `npm --version`

---

## 1. Move 合约（contracts/）

### 1.1 运行单元测试（TDD）

```bash
cd contracts
sui move test
```

### 1.2 构建

```bash
cd contracts
sui move build
```

### 1.3 部署到 testnet

```bash
cd contracts
sui client publish --gas-budget 100000000
```

部署成功后记录 `PackageId`，后续配置需要用到。

---

## 2. Bot（bot/）

### 2.1 安装依赖

```bash
cd bot
npm install
```

### 2.2 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入必要配置
```

必需配置项：
- `SUI_PRIVATE_KEY` - Bot 的私钥
- `VAULT_ID` - Vault 对象 ID
- `TRADER_CAP_ID` - TraderCap 对象 ID
- `PACKAGE_ID` - 合约包 ID

### 2.3 运行测试

```bash
npm test
```

### 2.4 开发模式

```bash
npm run dev
```

启动后访问 http://localhost:3000 查看 API 文档。

### 2.5 控制 Bot

```bash
# 启动 Bot
curl -X POST http://localhost:3000/control \
  -H "Content-Type: application/json" \
  -d '{"command": "start"}'

# 停止 Bot
curl -X POST http://localhost:3000/control \
  -H "Content-Type: application/json" \
  -d '{"command": "stop"}'

# 查看状态
curl http://localhost:3000/status
```

---

## 3. 前端（frontend/）

### 3.1 安装依赖

```bash
cd frontend
npm install
```

### 3.2 配置环境变量

```bash
# 编辑 .env.local
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_BOT_API_URL=http://localhost:3000
NEXT_PUBLIC_PACKAGE_ID=your_package_id_here
```

### 3.3 开发模式

```bash
npm run dev
```

访问 http://localhost:3001 查看管理面板。

---

## 4. 网络切换（testnet / localnet）

### 4.1 查看当前网络

```bash
sui client envs
```

### 4.2 切换网络

```bash
# 切到 testnet
sui client switch --env testnet

# 切到 localnet
sui client switch --env local
```

---

## 5. 获取测试币

### 5.1 testnet faucet

```bash
sui client faucet
```

### 5.2 localnet faucet

本地节点通常可用 `--with-faucet` 启动：

```bash
sui start --force-regenesis --with-faucet
```

---

## 6. 启动本地链（localnet）

PoC 的 E2E（端到端）建议优先在 localnet 跑通：

```bash
sui start --force-regenesis --with-faucet
```

然后切换客户端：

```bash
sui client switch --env local
sui client addresses
```

---

## 7. 完整工作流程

### 7.1 首次设置

1. 部署合约到 testnet
   ```bash
   cd contracts
   sui client publish --gas-budget 100000000
   # 记录 PackageId
   ```

2. 使用前端创建 Vault
   - 连接钱包
   - 点击"创建新 Vault"
   - 记录 Vault ID

3. 存入资金
   - 存入 SUI 和 USDC

4. 转移 TraderCap 给 Bot
   - 找到 TraderCap 对象 ID
   - 转移给 Bot 地址

5. 配置 Bot
   - 编辑 `.env` 填入所有 ID
   - 启动 Bot

### 7.2 日常运行

```bash
# 启动 Bot
cd bot
npm run dev

# 启动前端（另一个终端）
cd frontend
npm run dev
```

---

## 8. 调试

### 8.1 查看 Bot 日志

```bash
# Bot 控制台输出
# 或通过 API 查看
curl http://localhost:3000/logs
```

### 8.2 查看链上事件

```bash
# 查询 VaultCreatedEvent
sui client query-events --event-type "<PACKAGE_ID>::grid_vault::VaultCreatedEvent"
```

### 8.3 查看交易历史

```bash
curl http://localhost:3000/history
```

---

## 9. 项目结构

```
bot/
├── src/
│   ├── index.ts           # 主入口
│   ├── types/             # 类型定义
│   ├── config/            # 配置管理
│   ├── strategy/          # 网格策略
│   │   └── grid.ts
│   ├── quote/             # 报价服务
│   │   └── service.ts
│   ├── executor/          # 交易执行
│   │   └── executor.ts
│   ├── storage/           # SQLite 存储
│   │   └── storage.ts
│   └── api/               # HTTP API
│       └── server.ts
└── test/                  # 测试

frontend/
├── src/
│   ├── app/               # Next.js 页面
│   ├── components/        # React 组件
│   │   ├── SuiProvider.tsx
│   │   ├── VaultManager.tsx
│   │   ├── BotControl.tsx
│   │   └── TradeHistory.tsx
│   ├── hooks/             # 自定义 Hooks
│   │   └── useBotApi.ts
│   └── lib/               # 工具函数
│       ├── constants.ts
│       └── utils.ts
└── .env.local             # 环境变量
```

---

## 10. 常见问题

### Q: Bot 提示 "Missing configuration"

确保 `.env` 文件中填入了所有必需的配置项，特别是：
- VAULT_ID
- TRADER_CAP_ID
- PACKAGE_ID

### Q: 交易一直失败

检查：
1. Vault 是否已暂停
2. Bot 是否有足够的 gas
3. TraderCap 是否正确转移给 Bot 地址

### Q: 价格获取失败

可能是 Cetus Aggregator API 暂时不可用，Bot 会自动重试。

---

## 11. TDD 测试

### Bot 单元测试

```bash
cd bot
npm test
```

测试覆盖：
- 网格线计算
- 档位计算
- 网格决策逻辑
- 状态管理

### Move 单元测试

```bash
cd contracts
sui move test
```

测试覆盖：
- Vault 创建
- 权限控制
- 存取款
- 暂停功能
