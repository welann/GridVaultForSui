"use client"

import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react"
import { Transaction } from "@mysten/sui/transactions"
import { SuiClient } from "@mysten/sui/client"
import { useState, useCallback, useMemo, useEffect } from "react"
import { PACKAGE_ID, COIN_TYPE_SUI, COIN_TYPE_USDC, RPC_URL } from "@/lib/constants"
import { shortenAddress, formatAmount } from "@/lib/utils"

interface VaultManagerProps {
  onVaultCreated?: (vaultId: string, ownerCapId: string, traderCapId: string) => void
}

export function VaultManager({ onVaultCreated }: VaultManagerProps) {
  const account = useCurrentAccount()
  const dAppKit = useDAppKit()

  type DAppKitTxInput = Parameters<typeof dAppKit.signAndExecuteTransaction>[0]["transaction"]
  
  // Create independent SuiClient
  const suiClient = useMemo(() => {
    return new SuiClient({ 
      url: RPC_URL,
      network: "mainnet",
    })
  }, [])
  
  const [creating, setCreating] = useState(false)
  const [vaultId, setVaultId] = useState("")
  const [ownerCapId, setOwnerCapId] = useState("")
  const [traderCapId, setTraderCapId] = useState("")
  const [depositAmount, setDepositAmount] = useState("")
  const [selectedAsset, setSelectedAsset] = useState<"SUI" | "USDC">("SUI")
  const [userVaults, setUserVaults] = useState<Array<{id: string, balanceA: string, balanceB: string}>>([])

  const signAndExecute = async (tx: Transaction) => {
    return dAppKit.signAndExecuteTransaction({
      transaction: tx as unknown as DAppKitTxInput,
    })
  }

  /**
   * Query user's Vault list
   */
  const fetchUserVaults = useCallback(async () => {
    if (!account) return
    
    try {
      // Query OwnerCap objects owned by user
      const ownerCaps = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: {
          StructType: `${PACKAGE_ID}::grid_vault::OwnerCap`,
        },
        options: {
          showContent: true,
        },
      })
      
      // Get Vault corresponding to each OwnerCap
      const vaults = await Promise.all(
        ownerCaps.data.map(async (cap) => {
          const capData = cap.data?.content as any
          const vaultId = capData?.fields?.vault_id
          
          if (vaultId) {
            try {
              const vaultObj = await suiClient.getObject({
                id: vaultId,
                options: { showContent: true },
              })
              const vaultData = vaultObj.data?.content as any
              return {
                id: vaultId,
                balanceA: vaultData?.fields?.balance_a || "0",
                balanceB: vaultData?.fields?.balance_b || "0",
              }
            } catch {
              return null
            }
          }
          return null
        })
      )
      
      setUserVaults(vaults.filter(Boolean) as any)
    } catch (error) {
      console.error("Failed to fetch vaults:", error)
    }
  }, [account, suiClient])

  // Auto refresh Vault list
  useEffect(() => {
    if (!account) return
    fetchUserVaults()
    const interval = setInterval(fetchUserVaults, 5000)
    return () => clearInterval(interval)
  }, [account, fetchUserVaults])

  const createVault = async () => {
    if (!account || !PACKAGE_ID) return

    setCreating(true)
    try {
      const tx = new Transaction()
      
      // Call create_and_share to create Vault
      const [ownerCap, traderCap] = tx.moveCall({
        target: `${PACKAGE_ID}::grid_vault::create_and_share`,
        typeArguments: [COIN_TYPE_SUI, COIN_TYPE_USDC],
      })

      // Transfer OwnerCap and TraderCap to user
      tx.transferObjects([ownerCap, traderCap], account.address)

      const result = await signAndExecute(tx)

      if (result.FailedTransaction) {
        throw new Error(`Transaction failed: ${result.FailedTransaction.status.error?.message}`)
      }

      console.log("Vault created:", result)
      
      // Wait for object index to update
      setTimeout(async () => {
        await fetchUserVaults()
      }, 2000)
      
      onVaultCreated?.(vaultId, ownerCapId, traderCapId)
    } catch (error: any) {
      console.error("Create vault error:", error)
      alert(`Failed to create Vault: ${error.message}`)
    } finally {
      setCreating(false)
    }
  }

  const parseAmountToBigInt = (value: string, decimals: number): bigint | null => {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return null
    const [intPart, fracPart = ""] = trimmed.split(".")
    if (fracPart.length > decimals) return null
    const frac = fracPart.padEnd(decimals, "0")
    const full = `${intPart}${frac}`.replace(/^0+/, "") || "0"
    return BigInt(full)
  }

  const getDecimals = () => (selectedAsset === "SUI" ? 9 : 6)

  const depositAsset = async () => {
    if (!account || !vaultId || !depositAmount || !ownerCapId) {
      alert("Please enter Vault ID, OwnerCap ID and deposit amount")
      return
    }

    const decimals = getDecimals()
    const amount = parseAmountToBigInt(depositAmount, decimals)

    if (!amount || amount <= 0) {
      alert("Amount must be greater than 0 and decimals cannot exceed precision")
      return
    }

    const tx = new Transaction()

    if (selectedAsset === "SUI") {
      // Split coins
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)])

      tx.moveCall({
        target: `${PACKAGE_ID}::grid_vault::deposit_a`,
        typeArguments: [COIN_TYPE_SUI, COIN_TYPE_USDC],
        arguments: [
          tx.object(vaultId),
          tx.object(ownerCapId),
          coin,
        ],
      })
    } else {
      // USDC: Get coins from wallet
      const coins = await suiClient.getCoins({
        owner: account.address,
        coinType: COIN_TYPE_USDC,
      })

      if (coins.data.length === 0) {
        alert("No USDC in wallet")
        return
      }

      const total = coins.data.reduce((sum, c) => sum + BigInt(c.balance), BigInt(0))
      if (total < amount) {
        alert("Insufficient USDC balance")
        return
      }

      const primary = tx.object(coins.data[0].coinObjectId)
      const extras = coins.data.slice(1).map((c) => tx.object(c.coinObjectId))
      if (extras.length > 0) {
        tx.mergeCoins(primary, extras)
      }

      const [coin] = tx.splitCoins(primary, [tx.pure.u64(amount)])

      tx.moveCall({
        target: `${PACKAGE_ID}::grid_vault::deposit_b`,
        typeArguments: [COIN_TYPE_SUI, COIN_TYPE_USDC],
        arguments: [
          tx.object(vaultId),
          tx.object(ownerCapId),
          coin,
        ],
      })
    }

    try {
      const result = await signAndExecute(tx)
      
      if (result.FailedTransaction) {
        throw new Error(`Transaction failed: ${result.FailedTransaction.status.error?.message}`)
      }

      alert("Deposit successful!")
      setDepositAmount("")
      fetchUserVaults()
    } catch (error: any) {
      console.error("Deposit error:", error)
      alert(`Deposit failed: ${error.message}`)
    }
  }

  const withdrawAsset = async () => {
    if (!account || !vaultId || !depositAmount || !ownerCapId) {
      alert("Please enter Vault ID, OwnerCap ID and withdrawal amount")
      return
    }

    const decimals = getDecimals()
    const amount = parseAmountToBigInt(depositAmount, decimals)

    if (!amount || amount <= 0) {
      alert("Amount must be greater than 0 and decimals cannot exceed precision")
      return
    }

    const tx = new Transaction()

    if (selectedAsset === "SUI") {
      const coin = tx.moveCall({
        target: `${PACKAGE_ID}::grid_vault::withdraw_a`,
        typeArguments: [COIN_TYPE_SUI, COIN_TYPE_USDC],
        arguments: [
          tx.object(vaultId),
          tx.object(ownerCapId),
          tx.pure.u64(amount),
        ],
      })
      tx.transferObjects([coin], account.address)
    } else {
      const coin = tx.moveCall({
        target: `${PACKAGE_ID}::grid_vault::withdraw_b`,
        typeArguments: [COIN_TYPE_SUI, COIN_TYPE_USDC],
        arguments: [
          tx.object(vaultId),
          tx.object(ownerCapId),
          tx.pure.u64(amount),
        ],
      })
      tx.transferObjects([coin], account.address)
    }

    try {
      const result = await signAndExecute(tx)
      
      if (result.FailedTransaction) {
        throw new Error(`Transaction failed: ${result.FailedTransaction.status.error?.message}`)
      }

      alert("Withdrawal successful!")
      setDepositAmount("")
      fetchUserVaults()
    } catch (error: any) {
      console.error("Withdraw error:", error)
      alert(`Withdrawal failed: ${error.message}`)
    }
  }

  const setPaused = async (paused: boolean) => {
    if (!account || !vaultId || !ownerCapId) {
      alert("Please enter Vault ID and OwnerCap ID")
      return
    }

    const tx = new Transaction()
    
    tx.moveCall({
      target: `${PACKAGE_ID}::grid_vault::set_paused`,
      typeArguments: [COIN_TYPE_SUI, COIN_TYPE_USDC],
      arguments: [
        tx.object(vaultId),
        tx.object(ownerCapId),
        tx.pure.bool(paused),
      ],
    })

    try {
      const result = await signAndExecute(tx)
      
      if (result.FailedTransaction) {
        throw new Error(`Transaction failed: ${result.FailedTransaction.status.error?.message}`)
      }

      alert(paused ? "Vault paused" : "Vault resumed")
      fetchUserVaults()
    } catch (error: any) {
      console.error("Set paused error:", error)
      alert(`Operation failed: ${error.message}`)
    }
  }

  if (!account) {
    return (
      <div className="card connect-prompt">
        <div className="connect-icon">🔌</div>
        <p>Please connect your wallet to continue</p>
      </div>
    )
  }

  return (
    <div className="vault-manager">
      <div className="card">
        <h2>🏦 Vault Manager</h2>
        
        <div className="section">
          <h3>🏦 Create Vault</h3>
          <button 
            onClick={createVault} 
            disabled={creating || !PACKAGE_ID}
            className="btn btn-primary"
          >
            {creating ? "Creating..." : "Create New Vault"}
          </button>
          <button 
            onClick={fetchUserVaults}
            className="btn btn-secondary"
          >
            🔄 Refresh
          </button>
          {!PACKAGE_ID && (
            <p className="hint warn">⚠️ Please configure PACKAGE_ID in environment variables first</p>
          )}
        </div>

        {userVaults.length > 0 && (
          <div className="section">
            <h3>📂 My Vaults</h3>
            {userVaults.map((vault) => (
              <div key={vault.id} className="vault-item">
                <p>ID: {shortenAddress(vault.id)}</p>
                <p>SUI: {formatAmount(vault.balanceA, 9)}</p>
                <p>USDC: {formatAmount(vault.balanceB, 6)}</p>
              </div>
            ))}
          </div>
        )}

        <div className="section">
          <h3>💰 Fund Operations</h3>
          <div className="toggle-row">
            <button
              onClick={() => setSelectedAsset("SUI")}
              className={`btn ${selectedAsset === "SUI" ? "btn-primary" : "btn-secondary"}`}
            >
              SUI
            </button>
            <button
              onClick={() => setSelectedAsset("USDC")}
              className={`btn ${selectedAsset === "USDC" ? "btn-primary" : "btn-secondary"}`}
            >
              USDC
            </button>
          </div>
          <input
            type="text"
            placeholder="Vault ID"
            value={vaultId}
            onChange={(e) => setVaultId(e.target.value)}
            className="input"
          />
          <input
            type="text"
            placeholder="OwnerCap ID"
            value={ownerCapId}
            onChange={(e) => setOwnerCapId(e.target.value)}
            className="input"
          />
          <input
            type="number"
            placeholder={`Amount (${selectedAsset})`}
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className="input"
          />
          <div className="button-row">
            <button onClick={depositAsset} className="btn btn-primary">
              Deposit {selectedAsset}
            </button>
            <button onClick={withdrawAsset} className="btn btn-secondary">
              Withdraw {selectedAsset}
            </button>
          </div>
        </div>

        <div className="section">
          <h3>⏸️ Pause Control</h3>
          <div className="button-row">
            <button onClick={() => setPaused(true)} className="btn btn-danger">
              Pause Trading
            </button>
            <button onClick={() => setPaused(false)} className="btn btn-success">
              Resume Trading
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .vault-manager {
          margin-bottom: 24px;
        }
        .card {
          background: rgba(23, 23, 30, 0.8);
          border: 1px solid rgba(99, 102, 241, 0.15);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          color: #e5e7eb;
        }
        .connect-prompt {
          text-align: center;
          padding: 40px 24px;
        }
        .connect-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.8;
        }
        .connect-prompt p {
          color: #9ca3af;
          font-size: 15px;
        }
        h2 {
          margin-bottom: 20px;
          font-size: 20px;
          font-weight: 600;
          color: #e5e7eb;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        h3 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: #818cf8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .section {
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(99, 102, 241, 0.1);
        }
        .section:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        .vault-item {
          padding: 14px;
          background: rgba(17, 17, 24, 0.6);
          border: 1px solid rgba(99, 102, 241, 0.1);
          border-radius: 10px;
          margin-bottom: 10px;
          font-size: 13px;
          transition: all 0.2s;
        }
        .vault-item:hover {
          border-color: rgba(99, 102, 241, 0.25);
          background: rgba(17, 17, 24, 0.8);
        }
        .vault-item p {
          margin: 6px 0;
          display: flex;
          justify-content: space-between;
        }
        .vault-item p:first-child {
          color: #6b7280;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .input {
          width: 100%;
          padding: 12px 14px;
          margin-bottom: 12px;
          background: rgba(17, 17, 24, 0.8);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 10px;
          font-size: 14px;
          color: #e5e7eb;
          transition: all 0.2s;
        }
        .input:focus {
          outline: none;
          border-color: rgba(99, 102, 241, 0.5);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }
        .input::placeholder {
          color: #4b5563;
        }
        .button-row {
          display: flex;
          gap: 12px;
        }
        .toggle-row {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
        }
        .btn {
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }
        .btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-primary {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
        }
        .btn-secondary {
          background: rgba(99, 102, 241, 0.1);
          color: #a5b4fc;
          border: 1px solid rgba(99, 102, 241, 0.2);
        }
        .btn-secondary:hover:not(:disabled) {
          background: rgba(99, 102, 241, 0.2);
        }
        .btn-success {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          color: white;
        }
        .btn-danger {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
        }
        .hint {
          margin-top: 12px;
          font-size: 12px;
          color: #6b7280;
          padding: 10px 14px;
          background: rgba(17, 17, 24, 0.5);
          border-radius: 8px;
          border-left: 3px solid #6366f1;
        }
        .hint.warn {
          border-left-color: #f59e0b;
          background: rgba(251, 191, 36, 0.1);
          color: #fbbf24;
        }
      `}</style>
    </div>
  )
}
