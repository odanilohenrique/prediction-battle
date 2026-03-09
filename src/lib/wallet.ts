import { Connector } from 'wagmi';

export function getPrioritizedConnector(connectors: readonly Connector[] | Connector[]) {
    // 1. Rabby (Web3 Power Users)
    const rabbyConnector = connectors.find((c) => c.id === 'io.rabby');

    // 2. Standard Injected (MetaMask, Trust, OKX Web3)
    const injectedConnector = connectors.find((c) => c.id === 'injected');

    // 3. Explicit MetaMask
    const metaMaskConnector = connectors.find((c) => c.id === 'metaMask');

    // 4. Coinbase Smart Wallet / App (Lowest Priority Fallback)
    const coinbaseConnector = connectors.find((c) => c.id === 'coinbaseWalletSDK');

    return rabbyConnector || injectedConnector || metaMaskConnector || coinbaseConnector || connectors[0];
}
