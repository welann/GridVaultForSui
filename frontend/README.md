# GridVault 前端

Next.js + @mysten/dapp-kit-react 构建的网格交易机器人管理面板。

## 功能

- 🔌 钱包连接（Sui Wallet）
- 🏦 Vault 创建与管理
- 💰 资金存入/取出
- 🤖 Bot 状态监控
- ⚙️ 网格参数配置
- 📜 交易历史查看

## 技术栈

- **框架**: Next.js 15 (App Router)
- **UI 库**: React 19
- **钱包**: @mysten/dapp-kit-react
- **样式**: CSS-in-JS (styled-jsx)

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

## 环境变量

```bash
# 复制环境变量文件
cp .env.local.example .env.local

# 编辑 .env.local 填入以下配置
```

### 必需配置

```env
# 网络类型: testnet | mainnet | localnet
NEXT_PUBLIC_NETWORK=testnet

# Bot API 地址（与 bot/.env 中的 API_PORT 保持一致）
NEXT_PUBLIC_BOT_API_URL=http://localhost:3215

# 合约包 ID（部署合约后填入）
NEXT_PUBLIC_PACKAGE_ID=0x...
```

## dApp Kit 配置

本项目使用 `@mysten/dapp-kit-react` (v1.x) 进行钱包连接。配置位于：

- `src/lib/dapp-kit.ts` - dApp Kit 实例配置
- `src/components/WalletApp.tsx` - 钱包应用包装器
- `src/app/page.tsx` - 页面入口（动态导入，禁用 SSR）

### 关键配置说明

由于钱包检测依赖浏览器的 `window` 对象，必须使用 **客户端渲染**：

```typescript
// src/app/page.tsx
'use client';

import dynamic from 'next/dynamic';

const WalletApp = dynamic(() => import('@/components/WalletApp'), {
  ssr: false,  // 禁用服务端渲染
});
```

## 使用流程

1. **连接钱包**: 点击 "Connect Wallet" 按钮连接 Sui 钱包
2. **创建 Vault**: 在 Vault 管理面板点击 "创建新 Vault"
3. **存入资金**: 
   - 输入 Vault ID 和 OwnerCap ID
   - 输入存款金额，点击 "存入 SUI"
4. **配置 Bot**: 在右侧面板设置网格参数
5. **启动 Bot**: 点击 "▶ 启动" 开始网格交易

## 项目结构

```
frontend/
├── src/
│   ├── app/
│   │   ├── globals.css      # 全局样式
│   │   ├── layout.tsx       # 根布局
│   │   └── page.tsx         # 首页（动态导入 WalletApp）
│   ├── components/
│   │   ├── WalletApp.tsx    # 钱包应用主组件
│   │   ├── VaultManager.tsx # Vault 管理组件
│   │   ├── BotControl.tsx   # Bot 控制面板
│   │   └── TradeHistory.tsx # 交易历史
│   ├── lib/
│   │   ├── dapp-kit.ts      # dApp Kit 配置
│   │   ├── constants.ts     # 常量定义
│   │   └── utils.ts         # 工具函数
│   └── hooks/
│       └── useBotApi.ts     # Bot API Hook
├── .env.local               # 环境变量（不提交到 Git）
└── next.config.ts           # Next.js 配置
```

## 常见问题

### ConnectButton 下拉菜单不显示

已在 `globals.css` 和 `WalletApp.tsx` 中添加了修复样式：

```css
/* 确保下拉菜单的 z-index 足够高 */
dapp-kit-connect-button::part(account-dropdown) {
  z-index: 9999 !important;
}
```

### 构建错误 "ssr: false is not allowed"

确保 `page.tsx` 顶部有 `'use client'` 指令。

## 注意事项

- 钱包组件必须使用 `ssr: false` 动态导入
- 所有与钱包交互的组件都必须在客户端渲染
- 确保 `.env.local` 中的 `NEXT_PUBLIC_PACKAGE_ID` 已正确设置
