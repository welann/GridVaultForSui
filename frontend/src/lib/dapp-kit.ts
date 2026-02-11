import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

export const dAppKit = createDAppKit({
	networks: ['testnet', 'mainnet', 'localnet'],
	createClient: (network) => {
		return new SuiClient({ 
			url: getFullnodeUrl(network as 'testnet' | 'mainnet' | 'localnet')
		})
	},
});

// Register types for hook type inference
declare module '@mysten/dapp-kit-react' {
	interface Register {
		dAppKit: typeof dAppKit;
	}
}
