'use client';

import { DAppKitProvider, ConnectButton } from '@mysten/dapp-kit-react';
import { dAppKit } from '@/lib/dapp-kit';
import { VaultManager } from './VaultManager';
import { BotControl } from './BotControl';
import { TradeHistory } from './TradeHistory';
import { LogPanel } from './LogPanel';
import { GridStatus } from './GridStatus';
import { BotApiConfig } from './BotApiConfig';

export default function WalletApp() {
	return (
		<DAppKitProvider dAppKit={dAppKit}>
			<main className="main">
				{/* Hero Banner */}
				<section className="hero">
					<div className="hero-bg">
						<div className="gradient-orb orb-1" />
						<div className="gradient-orb orb-2" />
						<div className="gradient-orb orb-3" />
						<div className="grid-overlay" />
					</div>
					<div className="container">
						<div className="hero-content">
							<div className="hero-badge">
								<span className="pulse-dot" />
								<span className="badge-text">Sui Blockchain</span>
							</div>
							<h1 className="hero-title">
								<span className="gradient-text">GridVault</span>
							</h1>
							<p className="hero-subtitle">
								Intelligent Grid Trading Bot
							</p>
							<p className="hero-description">
								Automated buy-low-sell-high strategies on Sui.
								<br />
								Secure. Efficient. Decentralized.
							</p>
							<div className="hero-stats">
								<div className="stat-item">
									<span className="stat-value">∞</span>
									<span className="stat-label">24/7 Trading</span>
								</div>
								<div className="stat-divider" />
								<div className="stat-item">
									<span className="stat-value">&lt;1s</span>
									<span className="stat-label">Tick Speed</span>
								</div>
								<div className="stat-divider" />
								<div className="stat-item">
									<span className="stat-value">100%</span>
									<span className="stat-label">On-Chain</span>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Header */}
				<header className="header">
					<div className="container">
						<div className="header-content">
							<div className="logo">
								<div className="logo-icon-wrapper">
									<svg className="logo-svg" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
										<rect className="logo-rect" x="2" y="2" width="12" height="12" rx="2" />
										<rect className="logo-rect" x="18" y="2" width="12" height="12" rx="2" />
										<rect className="logo-rect" x="2" y="18" width="12" height="12" rx="2" />
										<rect className="logo-rect" x="18" y="18" width="12" height="12" rx="2" />
									</svg>
								</div>
								<span className="logo-text">GridVault</span>
							</div>
							<div className="wallet-button-container">
								<ConnectButton />
							</div>
						</div>
					</div>
				</header>

				{/* Main Content */}
				<div className="container">
					<div className="content">
						{/* Left: Vault Management */}
						<div className="left-panel">
							<GridStatus />
							<VaultManager />
						</div>

						{/* Right: Bot Control */}
						<div className="right-panel">
							<BotApiConfig />
							<BotControl />
							<LogPanel />
							<TradeHistory />
						</div>
					</div>
				</div>

				<style jsx>{`
					.main {
						min-height: 100vh;
						background: linear-gradient(180deg, #0a0a0f 0%, #111118 50%, #0d0d12 100%);
						color: #e5e7eb;
					}

					/* Hero Section */
					.hero {
						position: relative;
						padding: 80px 0 60px;
						overflow: hidden;
					}

					.hero-bg {
						position: absolute;
						inset: 0;
						pointer-events: none;
					}

					.gradient-orb {
						position: absolute;
						border-radius: 50%;
						filter: blur(80px);
						opacity: 0.5;
						animation: float 20s ease-in-out infinite;
					}

					.orb-1 {
						width: 400px;
						height: 400px;
						background: radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%);
						top: -100px;
						left: 10%;
						animation-delay: 0s;
					}

					.orb-2 {
						width: 300px;
						height: 300px;
						background: radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, transparent 70%);
						top: 20%;
						right: 15%;
						animation-delay: -7s;
					}

					.orb-3 {
						width: 250px;
						height: 250px;
						background: radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%);
						bottom: 0;
						left: 40%;
						animation-delay: -14s;
					}

					@keyframes float {
						0%, 100% { transform: translateY(0) scale(1); }
						33% { transform: translateY(-30px) scale(1.05); }
						66% { transform: translateY(20px) scale(0.95); }
					}

					.grid-overlay {
						position: absolute;
						inset: 0;
						background-image: 
							linear-gradient(rgba(99, 102, 241, 0.03) 1px, transparent 1px),
							linear-gradient(90deg, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
						background-size: 60px 60px;
						mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%);
					}

					.hero-content {
						text-align: center;
						position: relative;
						z-index: 1;
					}

					.hero-badge {
						display: inline-flex;
						align-items: center;
						gap: 8px;
						padding: 8px 16px;
						background: rgba(99, 102, 241, 0.1);
						border: 1px solid rgba(99, 102, 241, 0.2);
						border-radius: 9999px;
						margin-bottom: 24px;
						backdrop-filter: blur(10px);
					}

					.pulse-dot {
						width: 8px;
						height: 8px;
						background: #22c55e;
						border-radius: 50%;
						animation: pulse 2s ease-in-out infinite;
					}

					@keyframes pulse {
						0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
						50% { opacity: 0.8; box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
					}

					.badge-text {
						font-size: 13px;
						font-weight: 500;
						color: #818cf8;
						text-transform: uppercase;
						letter-spacing: 0.5px;
					}

					.hero-title {
						font-size: 72px;
						font-weight: 800;
						margin-bottom: 8px;
						letter-spacing: -0.04em;
					}

					@media (max-width: 768px) {
						.hero-title {
							font-size: 48px;
						}
					}

					.gradient-text {
						background: linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #60a5fa 100%);
						-webkit-background-clip: text;
						-webkit-text-fill-color: transparent;
						background-clip: text;
						background-size: 200% 200%;
						animation: gradient-shift 8s ease infinite;
					}

					@keyframes gradient-shift {
						0% { background-position: 0% 50%; }
						50% { background-position: 100% 50%; }
						100% { background-position: 0% 50%; }
					}

					.hero-subtitle {
						font-size: 24px;
						font-weight: 300;
						color: #a5b4fc;
						margin-bottom: 16px;
						letter-spacing: 0.1em;
						text-transform: uppercase;
					}

					@media (max-width: 768px) {
						.hero-subtitle {
							font-size: 16px;
						}
					}

					.hero-description {
						font-size: 16px;
						color: #6b7280;
						line-height: 1.6;
						max-width: 480px;
						margin: 0 auto 32px;
					}

					.hero-stats {
						display: flex;
						justify-content: center;
						align-items: center;
						gap: 32px;
					}

					@media (max-width: 640px) {
						.hero-stats {
							flex-direction: column;
							gap: 16px;
						}
					}

					.stat-item {
						display: flex;
						flex-direction: column;
						align-items: center;
						gap: 4px;
					}

					.stat-value {
						font-size: 24px;
						font-weight: 700;
						color: #e5e7eb;
					}

					.stat-label {
						font-size: 12px;
						color: #6b7280;
						text-transform: uppercase;
						letter-spacing: 0.5px;
					}

					.stat-divider {
						width: 1px;
						height: 40px;
						background: linear-gradient(to bottom, transparent, rgba(99, 102, 241, 0.3), transparent);
					}

					@media (max-width: 640px) {
						.stat-divider {
							width: 60px;
							height: 1px;
						}
					}

					/* Header */
					.header {
						background: rgba(17, 17, 24, 0.8);
						border-bottom: 1px solid rgba(99, 102, 241, 0.1);
						padding: 16px 0;
						position: sticky;
						top: 0;
						z-index: 100;
						backdrop-filter: blur(20px);
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

					.logo-icon-wrapper {
						width: 36px;
						height: 36px;
						display: flex;
						align-items: center;
						justify-content: center;
					}

					.logo-svg {
						width: 100%;
						height: 100%;
					}

					.logo-rect {
						fill: none;
						stroke: url(#logoGradient);
						stroke-width: 2;
						animation: draw 3s ease-in-out infinite alternate;
					}

					@keyframes draw {
						0% { stroke-dasharray: 0 100; opacity: 0.5; }
						100% { stroke-dasharray: 100 0; opacity: 1; }
					}

					.logo-text {
						font-size: 20px;
						font-weight: 700;
						background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%);
						-webkit-background-clip: text;
						-webkit-text-fill-color: transparent;
						background-clip: text;
					}

					.wallet-button-container {
						position: relative;
						z-index: 1000;
					}

					/* Main Content */
					.content {
						display: grid;
						grid-template-columns: 400px 1fr;
						gap: 24px;
						padding: 32px 0;
					}

					@media (max-width: 1024px) {
						.content {
							grid-template-columns: 1fr;
						}
					}

					.left-panel {
						position: sticky;
						top: 88px;
						height: fit-content;
					}

					@media (max-width: 1024px) {
						.left-panel {
							position: relative;
							top: 0;
						}
					}
				`}</style>

				{/* SVG Gradient Definition */}
				<svg width="0" height="0" style={{ position: 'absolute' }}>
					<defs>
						<linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="0%" stopColor="#818cf8" />
							<stop offset="100%" stopColor="#c084fc" />
						</linearGradient>
					</defs>
				</svg>

				{/* Global Styles for dark theme cards */}
				<style jsx global>{`
					/* Dark theme card overrides */
					.card {
						background: rgba(23, 23, 30, 0.8) !important;
						border: 1px solid rgba(99, 102, 241, 0.15) !important;
						border-radius: 16px !important;
						box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3) !important;
						backdrop-filter: blur(10px) !important;
						color: #e5e7eb !important;
					}

					.card h2 {
						color: #e5e7eb !important;
					}

					.card h3 {
						color: #9ca3af !important;
					}

					.card .row {
						border-color: rgba(99, 102, 241, 0.1) !important;
					}

					.card .label {
						color: #6b7280 !important;
					}

					.card .value {
						color: #e5e7eb !important;
					}

					.card .hint {
						background: rgba(234, 179, 8, 0.1) !important;
						color: #fbbf24 !important;
						border: 1px solid rgba(234, 179, 8, 0.2) !important;
					}

					/* Input dark theme */
					.input {
						background: rgba(17, 17, 24, 0.8) !important;
						border-color: rgba(99, 102, 241, 0.2) !important;
						color: #e5e7eb !important;
					}

					.input:focus {
						outline: none !important;
						border-color: rgba(99, 102, 241, 0.5) !important;
						box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1) !important;
					}

					.input::placeholder {
						color: #4b5563 !important;
					}

					/* Button dark theme adjustments */
					.btn-secondary {
						background: rgba(99, 102, 241, 0.1) !important;
						color: #a5b4fc !important;
						border: 1px solid rgba(99, 102, 241, 0.2) !important;
					}

					.btn-secondary:hover {
						background: rgba(99, 102, 241, 0.2) !important;
					}

					/* Vault item dark theme */
					.vault-item {
						background: rgba(17, 17, 24, 0.6) !important;
						border: 1px solid rgba(99, 102, 241, 0.1) !important;
					}

					/* dApp Kit dropdown fixes */
					dapp-kit-connect-button {
						position: relative;
						z-index: 1000;
					}

					dapp-kit-account-dropdown,
					[data-scope="dapp-kit"][data-part="account-dropdown"] {
						z-index: 9999 !important;
					}

					body {
						overflow-x: hidden;
						overflow-y: auto;
					}
				`}</style>
			</main>
		</DAppKitProvider>
	);
}
