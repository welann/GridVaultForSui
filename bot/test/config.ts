/**
 * 合约测试配置文件
 * 从 .env 文件加载配置
 */
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载 .env 文件
config({ path: join(__dirname, '..', '.env') });

// 网络配置
export const SUI_NETWORK = process.env.SUI_NETWORK || 'testnet';
export const SUI_RPC_URL = process.env.SUI_RPC_URL || getDefaultRpcUrl(SUI_NETWORK);

// 密钥配置
export const SUI_PRIVATE_KEY = process.env.SUI_PRIVATE_KEY || '';

// 合约配置
export const PACKAGE_ID = process.env.PACKAGE_ID || '';
export const VAULT_ID = process.env.VAULT_ID || '';
export const OWNER_CAP_ID = process.env.OWNER_CAP_ID || '';
export const TRADER_CAP_ID = process.env.TRADER_CAP_ID || '';

// 交易配置
export const GAS_BUDGET = BigInt(process.env.GAS_BUDGET || '10000000');
export const TX_TIMEOUT_MS = parseInt(process.env.TX_TIMEOUT_MS || '30000');

// 代币类型配置
export const COIN_TYPE_A = process.env.COIN_TYPE_A || '0x2::sui::SUI';
export const COIN_TYPE_B = process.env.COIN_TYPE_B || '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN';

// 模块名称
export const MODULE_NAME = 'grid_vault';

function getDefaultRpcUrl(network: string): string {
  switch (network) {
    case 'mainnet':
      return 'https://fullnode.mainnet.sui.io:443';
    case 'testnet':
      return 'https://fullnode.testnet.sui.io:443';
    case 'localnet':
      return 'http://127.0.0.1:9000';
    default:
      return 'https://fullnode.testnet.sui.io:443';
  }
}

// 验证必要配置
export function validateConfig(): void {
  const missing: string[] = [];

  if (!SUI_PRIVATE_KEY) {
    missing.push('SUI_PRIVATE_KEY');
  }

  if (!PACKAGE_ID) {
    missing.push('PACKAGE_ID');
  }

  if (missing.length > 0) {
    console.warn('⚠️  警告: 以下配置项未设置，部分测试可能无法运行:');
    missing.forEach(key => console.warn(`   - ${key}`));
    console.warn('\n请检查 contracts/.env 文件\n');
  }
}

// 打印当前配置
export function printConfig(): void {
  console.log('========================================');
  console.log('       GridVault 测试配置');
  console.log('========================================');
  console.log(`网络: ${SUI_NETWORK}`);
  console.log(`RPC: ${SUI_RPC_URL}`);
  console.log(`Package ID: ${PACKAGE_ID || '(未设置)'}`);
  console.log(`Vault ID: ${VAULT_ID || '(未设置)'}`);
  console.log(`OwnerCap ID: ${OWNER_CAP_ID || '(未设置)'}`);
  console.log(`TraderCap ID: ${TRADER_CAP_ID || '(未设置)'}`);
  console.log(`Coin A: ${COIN_TYPE_A}`);
  console.log(`Coin B: ${COIN_TYPE_B}`);
  console.log(`Gas Budget: ${GAS_BUDGET}`);
  console.log('========================================\n');
}
