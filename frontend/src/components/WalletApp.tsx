'use client';

import { DAppKitProvider, ConnectButton } from '@mysten/dapp-kit-react';
import { dAppKit } from '@/lib/dapp-kit';
import { VaultManager } from './VaultManager';
import { BotControl } from './BotControl';
import { TradeHistory } from './TradeHistory';

export default function WalletApp() {
	return (
		<DAppKitProvider dAppKit={dAppKit}>
			<main className="main">
				{/* 头部 */}
				<header className="header">
					<div className="container">
						<div className="header-content">
							<div className="logo">
								<span className="logo-icon">📊</span>
								<h1>GridVault</h1>
							</div>
							<div className="wallet-button-container">
								<ConnectButton />
							</div>
						</div>
					</div>
				</header>

				{/* 主内容 */}
				<div className="container">
					<div className="content">
						{/* 左侧：Vault 管理 */}
						<div className="left-panel">
							<VaultManager />
						</div>

						{/* 右侧：Bot 控制 */}
						<div className="right-panel">
							<BotControl />
							<TradeHistory />
						</div>
					</div>
				</div>

				<style jsx>{`
					.main {
						min-height: 100vh;
						background: #f5f5f5;
					}
					.header {
						background: white;
						border-bottom: 1px solid #e5e5e5;
						padding: 16px 0;
						position: relative;
						z-index: 100;
					}
					.header-content {
						display: flex;
						justify-content: space-between;
						align-items: center;
					}
					.logo {
						display: flex;
						align-items: center;
						gap: 12px;
					}
					.logo-icon {
						font-size: 32px;
					}
					.logo h1 {
						font-size: 24px;
						font-weight: 700;
						background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
						-webkit-background-clip: text;
						-webkit-text-fill-color: transparent;
						background-clip: text;
					}
					/* 钱包按钮容器 - 确保下拉菜单能正常显示 */
					.wallet-button-container {
						position: relative;
						z-index: 1000;
					}
					.content {
						display: grid;
						grid-template-columns: 400px 1fr;
						gap: 24px;
						padding: 24px 0;
					}
					@media (max-width: 1024px) {
						.content {
							grid-template-columns: 1fr;
						}
					}
					.left-panel {
						position: sticky;
						top: 24px;
						height: fit-content;
					}
				`}</style>
				{/* 全局样式覆盖 - 确保 dapp-kit 下拉菜单正确显示 */}
				<style jsx global>{`
					/* 确保下拉菜单容器有正确的 z-index */
					dapp-kit-connect-button {
						position: relative;
						z-index: 1000;
					}
					/* 下拉菜单样式覆盖 */
					dapp-kit-account-dropdown,
					[data-scope="dapp-kit"][data-part="account-dropdown"] {
						z-index: 9999 !important;
					}
					/* 确保 body 不会裁剪固定定位的元素 */
					body {
						overflow-x: hidden;
						overflow-y: auto;
					}
				`}</style>
			</main>
		</DAppKitProvider>
	);
}
