import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

const NETWORKS: Array<'mainnet'> = ['mainnet'];
type SupportedNetwork = (typeof NETWORKS)[number];
const resolvedDefaultNetwork: SupportedNetwork = 'mainnet';

export const dAppKit = createDAppKit<any, any>({
	networks: NETWORKS,
	defaultNetwork: resolvedDefaultNetwork,
	createClient: (network) => {
		return new SuiClient({
			url: getFullnodeUrl(network as SupportedNetwork),
			network: network as SupportedNetwork,
		}) as any;
	},
});

// Register types for hook type inference
declare module '@mysten/dapp-kit-react' {
	interface Register {
		dAppKit: typeof dAppKit;
	}
}
