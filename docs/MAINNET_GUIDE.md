# GridVault Mainnet 部署指南

## 前置准备

1. **确保有足够的 SUI 用于部署和交易**
   - 部署合约需要 ~3-5 SUI
   - 每次交易需要 ~0.01-0.05 SUI gas

2. **确认 Sui CLI 已配置 mainnet 环境**
```bash
sui client envs
# 如果没有 mainnet，添加：
sui client new-env --alias mainnet --rpc https://fullnode.mainnet.sui.io:443
```

## 步骤 1: 部署合约到 Mainnet

```bash
cd contracts

# 切换到 mainnet
sui client switch --env mainnet

# 确认当前地址（用于接收 OwnerCap）
sui client active-address

# 部署合约
sui client publish
```

部署成功后，记录以下信息：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              部署输出记录                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Package ID:    0x... (填入所有 PACKAGE_ID 位置)                             │
│ Vault:         0x... (填入 VAULT_ID)                                        │
│ OwnerCap:      0x... (你持有的管理权限)                                      │
│ TraderCap:     0x... (填入 TRADER_CAP_ID，转给 Bot)                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 步骤 2: 配置 Bot

编辑 `bot/.env`：

```env
# 网络配置
SUI_NETWORK=mainnet
SUI_RPC_URL=https://fullnode.mainnet.sui.io:443
# 或使用自定义 RPC
# SUI_RPC_URL=https://sui-mainnet.g.alchemy.com/v2/YOUR_KEY

# 合约配置（填入部署后的值）
PACKAGE_ID=0x...
VAULT_ID=0x...
TRADER_CAP_ID=0x...

# 交易对（Mainnet USDC）
COIN_TYPE_A=0x2::sui::SUI
COIN_TYPE_B=0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC

# 网格策略（根据市场调整）
GRID_LOWER_PRICE=0.8
GRID_UPPER_PRICE=1.1
GRID_LEVELS=6
GRID_AMOUNT_PER_GRID=0.3
```

## 步骤 3: 配置前端

编辑 `frontend/.env.local`：

```env
NEXT_PUBLIC_NETWORK=mainnet
NEXT_PUBLIC_BOT_API_URL=http://localhost:3215
NEXT_PUBLIC_PACKAGE_ID=0x...
```

## 步骤 4: 资金准备

### 存入 Vault（通过前端或 CLI）

```bash
# 使用 Sui CLI 调用 deposit 函数
# 注意：需要 OwnerCap 和足够的资金
```

### Bot 运行所需
- TraderCap 已持有（部署时生成，已填入 .env）
- Vault 中有足够的 A/B 代币用于交易

## 步骤 5: 启动系统

```bash
# 1. 启动 Bot
cd bot
npm run dev

# 2. 启动前端（新终端）
cd frontend
npm run dev
```

## Mainnet 注意事项

| 项目 | Testnet | Mainnet |
|------|---------|---------|
| **资金风险** | 无风险（测试币） | ⚠️ 真实资金，谨慎操作 |
| **Gas 费用** | 可忽略 | 需确保账户有足够 SUI |
| **RPC 节点** | 公共节点即可 | 建议使用 Alchemy/QuickNode |
| **交易速度** | ~1-3 秒 | ~1-3 秒 |
| **滑点设置** | 可测试宽松 | 建议 0.3%-0.5% |

## 安全建议

1. **小额测试**: 先用小额资金测试完整流程
2. **监控告警**: 配置 Telegram/Discord  webhook 通知
3. **Pause 机制**: 确保可以随时暂停交易
4. **私钥安全**: 使用硬件钱包或安全存储私钥
5. **定期检查**: 关注 Vault 余额和交易历史

## 故障排查

### 交易失败
```bash
# 检查 gas 余额
sui client gas

# 检查 Vault 余额（通过 Bot API）
curl http://localhost:3215/status
```

### 价格获取失败
- 确认 Cetus 在 mainnet 有该交易对的流动性
- 检查 RPC 节点连接

### 合约调用失败
- 确认 PACKAGE_ID、VAULT_ID、TRADER_CAP_ID 正确
- 确认 TraderCap 未被转移
