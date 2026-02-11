# GridVault 前端

Next.js 构建的网格交易机器人管理面板。

## 功能

- 🔌 钱包连接（Sui Wallet）
- 🏦 Vault 创建与管理
- 💰 资金存入/取出
- 🤖 Bot 状态监控
- ⚙️ 网格参数配置
- 📜 交易历史查看

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build
```

## 环境变量

```
NEXT_PUBLIC_NETWORK=testnet          # 网络类型
NEXT_PUBLIC_BOT_API_URL=http://...   # Bot API 地址
NEXT_PUBLIC_PACKAGE_ID=0x...         # 合约包 ID
```

## 使用流程

1. 连接 Sui 钱包
2. 创建 Vault（需要支付 gas）
3. 存入 SUI 和 USDC
4. 将 TraderCap 转移给 Bot 地址
5. 在配置面板设置网格参数
6. 启动 Bot
