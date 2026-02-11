/**
 * GridVault 前端常量配置
 */

// 网络配置
export const NETWORK = process.env.NEXT_PUBLIC_NETWORK ?? "testnet"

// RPC 端点
export const RPC_URL = NETWORK === "mainnet" 
  ? "https://fullnode.mainnet.sui.io:443"
  : NETWORK === "testnet"
  ? "https://fullnode.testnet.sui.io:443"
  : "http://127.0.0.1:9000"

// Bot API 配置
export const BOT_API_URL = process.env.NEXT_PUBLIC_BOT_API_URL ?? "http://localhost:3000"

// 合约配置（需要通过环境变量或部署后更新）
export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID ?? ""

// 代币类型
export const COIN_TYPE_SUI = "0x2::sui::SUI"
// USDC on Mainnet
export const COIN_TYPE_USDC = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC"

// 网格配置默认值
export const DEFAULT_GRID_CONFIG = {
  lowerPrice: 0.5,
  upperPrice: 2.0,
  levels: 10,
  amountPerGrid: 10,
  slippageBps: 50,
}
