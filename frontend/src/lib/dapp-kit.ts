import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { NETWORK } from './constants';

const NETWORKS = ['testnet', 'mainnet', 'localnet'] as const;

export const dAppKit = createDAppKit({
	networks: NETWORKS,
	defaultNetwork: NETWORKS.includes(NETWORK as (typeof NETWORKS)[number])
		? (NETWORK as (typeof NETWORKS)[number])
		: NETWORKS[0],
	createClient: (network) => {
		return new SuiClient({
			url: getFullnodeUrl(network),
			network,
		});
	},
});

// Register types for hook type inference
declare module '@mysten/dapp-kit-react' {
	interface Register {
		dAppKit: typeof dAppKit;
	}
}
