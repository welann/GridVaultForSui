'use client';

import dynamic from 'next/dynamic';

const WalletApp = dynamic(() => import('@/components/WalletApp'), {
	ssr: false,
	loading: () => (
		<div style={{ 
			minHeight: '100vh', 
			display: 'flex', 
			alignItems: 'center', 
			justifyContent: 'center',
			background: '#f5f5f5'
		}}>
			<div style={{ 
				padding: '24px 48px', 
				background: 'white',
				borderRadius: '12px',
				boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
			}}>
				Loading wallet...
			</div>
		</div>
	),
});

export default function Home() {
	return <WalletApp />;
}
