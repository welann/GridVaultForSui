/**
 * GridVault 前端常量配置
 */

// 网络配置
export const NETWORK = process.env.NEXT_PUBLIC_NETWORK ?? "testnet"

// Bot API 配置
export const BOT_API_URL = process.env.NEXT_PUBLIC_BOT_API_URL ?? "http://localhost:3000"

// 合约配置（需要通过环境变量或部署后更新）
export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID ?? ""

// 代币类型
export const COIN_TYPE_SUI = "0x2::sui::SUI"
export const COIN_TYPE_USDC = "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN"

// 网格配置默认值
export const DEFAULT_GRID_CONFIG = {
  lowerPrice: 0.5,
  upperPrice: 2.0,
  levels: 10,
  amountPerGrid: 10,
  slippageBps: 50,
}
