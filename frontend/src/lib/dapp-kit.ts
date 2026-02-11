import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';

export const dAppKit = createDAppKit({
	networks: ['testnet', 'mainnet', 'localnet'],
	createClient: (network) => {
		return new SuiJsonRpcClient({ 
			url: getJsonRpcFullnodeUrl(network as 'testnet' | 'mainnet' | 'localnet'),
			network: network as 'testnet' | 'mainnet' | 'localnet'
		})
	},
});

// Register types for hook type inference
declare module '@mysten/dapp-kit-react' {
	interface Register {
		dAppKit: typeof dAppKit;
	}
}
