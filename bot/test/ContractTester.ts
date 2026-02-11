/**
 * GridVault 合约测试工具类
 * 封装与合约的交互操作
 * 使用 @mysten/sui v1.x API (与 src 目录一致)
 */
import { 
  SuiClient, 
  getFullnodeUrl,
} from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import type { 
  SuiTransactionBlockResponse,
} from '@mysten/sui/client';
import * as config from './config.js';

export interface VaultInfo {
  id: string;
  balanceA: bigint;
  balanceB: bigint;
  paused: boolean;
  maxInPerTrade: bigint;
  cooldownMs: bigint;
}

export interface TestResult {
  success: boolean;
  name: string;
  duration: number;
  error?: string;
  digest?: string;
}

export class ContractTester {
  client: SuiClient;
  keypair: Ed25519Keypair;
  packageId: string;
  sender: string;

  constructor() {
    // 初始化客户端
    this.client = new SuiClient({ url: config.SUI_RPC_URL });
    
    // 初始化密钥对
    if (!config.SUI_PRIVATE_KEY) {
      throw new Error('SUI_PRIVATE_KEY 未设置');
    }
    // 处理 suiprivkey1 格式的私钥
    this.keypair = this.parsePrivateKey(config.SUI_PRIVATE_KEY);
    this.sender = this.keypair.toSuiAddress();
    this.packageId = config.PACKAGE_ID;
  }

  /**
   * 解析私钥，支持多种格式
   * v1.x 中 fromSecretKey 可以直接接受 suiprivkey1 格式的字符串
   */
  private parsePrivateKey(privateKey: string): Ed25519Keypair {
    // v1.x API 可以直接处理 suiprivkey1 格式的字符串
    return Ed25519Keypair.fromSecretKey(privateKey);
  }

  /**
   * 获取当前账户地址
   */
  getAddress(): string {
    return this.sender;
  }

  /**
   * 检查配置是否完整
   */
  isConfigValid(): boolean {
    return !!this.packageId && !!config.SUI_PRIVATE_KEY;
  }

  /**
   * 等待交易确认
   */
  async waitForTransaction(digest: string): Promise<SuiTransactionBlockResponse> {
    return this.client.waitForTransaction({
      digest,
      options: {
        showEffects: true,
        showEvents: true,
        showObjectChanges: true,
      },
    });
  }

  /**
   * 执行交易并等待确认
   */
  async executeTransaction(tx: Transaction): Promise<SuiTransactionBlockResponse> {
    tx.setSender(this.sender);
    tx.setGasBudget(config.GAS_BUDGET);

    const result = await this.client.signAndExecuteTransaction({
      signer: this.keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
        showObjectChanges: true,
      },
    });

    return this.waitForTransaction(result.digest);
  }

  /**
   * 创建 Vault
   */
  async createVault(): Promise<{ vaultId: string; ownerCapId: string; traderCapId: string; digest: string }> {
    const tx = new Transaction();
    
    const [ownerCap, traderCap] = tx.moveCall({
      target: `${this.packageId}::${config.MODULE_NAME}::create_and_share`,
      typeArguments: [config.COIN_TYPE_A, config.COIN_TYPE_B],
    });

    // 转移 OwnerCap 和 TraderCap 给发送者
    tx.transferObjects([ownerCap, traderCap], this.sender);

    const result = await this.executeTransaction(tx);
    
    // 从结果中提取对象 ID
    const objectChanges = result.objectChanges || [];
    const createdObjects = objectChanges.filter(
      (change: any) => change.type === 'created'
    );

    let vaultId = '';
    let ownerCapId = '';
    let traderCapId = '';

    for (const obj of createdObjects) {
      const objectType = (obj as any).objectType as string;
      if (objectType.includes('Vault<')) {
        vaultId = (obj as any).objectId;
      } else if (objectType.includes('OwnerCap')) {
        ownerCapId = (obj as any).objectId;
      } else if (objectType.includes('TraderCap')) {
        traderCapId = (obj as any).objectId;
      }
    }

    if (!vaultId || !ownerCapId || !traderCapId) {
      throw new Error('无法从交易结果中提取 Vault 或 Cap IDs');
    }

    return { vaultId, ownerCapId, traderCapId, digest: result.digest };
  }

  /**
   * 获取 Vault 信息
   */
  async getVaultInfo(vaultId: string): Promise<VaultInfo> {
    const response = await this.client.getObject({
      id: vaultId,
      options: { showContent: true },
    });

    if (!response.data?.content) {
      throw new Error(`无法获取 Vault ${vaultId} 的信息`);
    }

    const content = response.data.content as any;
    const fields = content.fields;

    return {
      id: vaultId,
      balanceA: BigInt(fields.balance_a || 0),
      balanceB: BigInt(fields.balance_b || 0),
      paused: fields.paused || false,
      maxInPerTrade: BigInt(fields.risk?.fields?.max_in_per_trade || 0),
      cooldownMs: BigInt(fields.risk?.fields?.cooldown_ms || 0),
    };
  }

  /**
   * 存款到 Vault (Coin A)
   */
  async depositA(vaultId: string, ownerCapId: string, amount: bigint): Promise<string> {
    const tx = new Transaction();
    const coins = await this.client.getCoins({
      owner: this.sender,
      coinType: config.COIN_TYPE_A,
    });

    if (coins.data.length === 0) {
      throw new Error('没有足够的 Coin A 用于存款');
    }

    // 合并所有 coins 并分割出需要的金额
    const primaryCoin = coins.data[0];
    const coinToDeposit = tx.splitCoins(tx.object(primaryCoin.coinObjectId), [tx.pure.u64(Number(amount))]);

    tx.moveCall({
      target: `${this.packageId}::${config.MODULE_NAME}::deposit_a`,
      typeArguments: [config.COIN_TYPE_A, config.COIN_TYPE_B],
      arguments: [
        tx.object(vaultId),
        tx.object(ownerCapId),
        coinToDeposit,
      ],
    });

    const result = await this.executeTransaction(tx);
    return result.digest;
  }

  /**
   * 存款到 Vault (Coin B)
   */
  async depositB(vaultId: string, ownerCapId: string, amount: bigint): Promise<string> {
    const tx = new Transaction();
    const coins = await this.client.getCoins({
      owner: this.sender,
      coinType: config.COIN_TYPE_B,
    });

    if (coins.data.length === 0) {
      throw new Error('没有足够的 Coin B 用于存款');
    }

    const primaryCoin = coins.data[0];
    const coinToDeposit = tx.splitCoins(tx.object(primaryCoin.coinObjectId), [tx.pure.u64(Number(amount))]);

    tx.moveCall({
      target: `${this.packageId}::${config.MODULE_NAME}::deposit_b`,
      typeArguments: [config.COIN_TYPE_A, config.COIN_TYPE_B],
      arguments: [
        tx.object(vaultId),
        tx.object(ownerCapId),
        coinToDeposit,
      ],
    });

    const result = await this.executeTransaction(tx);
    return result.digest;
  }

  /**
   * 从 Vault 取款 (Coin A)
   */
  async withdrawA(vaultId: string, ownerCapId: string, amount: bigint): Promise<string> {
    const tx = new Transaction();

    const [coin] = tx.moveCall({
      target: `${this.packageId}::${config.MODULE_NAME}::withdraw_a`,
      typeArguments: [config.COIN_TYPE_A, config.COIN_TYPE_B],
      arguments: [
        tx.object(vaultId),
        tx.object(ownerCapId),
        tx.pure.u64(Number(amount)),
      ],
    });

    tx.transferObjects([coin], this.sender);

    const result = await this.executeTransaction(tx);
    return result.digest;
  }

  /**
   * 从 Vault 取款 (Coin B)
   */
  async withdrawB(vaultId: string, ownerCapId: string, amount: bigint): Promise<string> {
    const tx = new Transaction();

    const [coin] = tx.moveCall({
      target: `${this.packageId}::${config.MODULE_NAME}::withdraw_b`,
      typeArguments: [config.COIN_TYPE_A, config.COIN_TYPE_B],
      arguments: [
        tx.object(vaultId),
        tx.object(ownerCapId),
        tx.pure.u64(Number(amount)),
      ],
    });

    tx.transferObjects([coin], this.sender);

    const result = await this.executeTransaction(tx);
    return result.digest;
  }

  /**
   * 设置暂停状态
   */
  async setPaused(vaultId: string, ownerCapId: string, paused: boolean): Promise<string> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::${config.MODULE_NAME}::set_paused`,
      typeArguments: [config.COIN_TYPE_A, config.COIN_TYPE_B],
      arguments: [
        tx.object(vaultId),
        tx.object(ownerCapId),
        tx.pure.bool(paused),
      ],
    });

    const result = await this.executeTransaction(tx);
    return result.digest;
  }

  /**
   * 设置风险参数
   */
  async setRiskParams(
    vaultId: string, 
    ownerCapId: string, 
    maxInPerTrade: bigint, 
    cooldownMs: bigint
  ): Promise<string> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::${config.MODULE_NAME}::set_risk_params`,
      typeArguments: [config.COIN_TYPE_A, config.COIN_TYPE_B],
      arguments: [
        tx.object(vaultId),
        tx.object(ownerCapId),
        tx.pure.u64(Number(maxInPerTrade)),
        tx.pure.u64(Number(cooldownMs)),
      ],
    });

    const result = await this.executeTransaction(tx);
    return result.digest;
  }

  /**
   * 获取账户余额
   */
  async getBalances() {
    const balances = await this.client.getAllBalances({
      owner: this.sender,
    });
    return balances;
  }

  /**
   * 获取特定代币余额
   */
  async getCoinBalance(coinType: string): Promise<bigint> {
    try {
      const balance = await this.client.getBalance({
        owner: this.sender,
        coinType,
      });
      return BigInt(balance.totalBalance);
    } catch {
      return BigInt(0);
    }
  }

  /**
   * 请求测试币（仅 testnet/devnet）
   */
  async requestFaucet(coinType: string = '0x2::sui::SUI'): Promise<void> {
    if (config.SUI_NETWORK === 'mainnet') {
      throw new Error('主网无法使用水龙头');
    }

    const response = await fetch(`https://faucet.${config.SUI_NETWORK}.sui.io/gas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        FixedAmountRequest: {
          recipient: this.sender,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`水龙头请求失败: ${response.statusText}`);
    }

    // 等待交易确认
    const result: any = await response.json();
    if (result.transferredGasObjects && result.transferredGasObjects.length > 0) {
      const digest = result.transferredGasObjects[0].transferTxDigest;
      await this.waitForTransaction(digest);
    }
  }
}
