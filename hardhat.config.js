
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config({ path: ".env.production" }); // Load prod first if it exists
require("dotenv").config({ path: ".env.local" }); // Fallback to local

let privateKey = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || "";
if (privateKey.startsWith("0x")) {
    privateKey = privateKey.slice(2);
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            viaIR: true,
        },
    },
    networks: {
        baseSepolia: {
            url: process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org",
            accounts: privateKey ? [`0x${privateKey}`] : [],
        },
        base: {
            url: "https://mainnet.base.org",
            accounts: privateKey ? [`0x${privateKey}`] : [],
        },
    },
    etherscan: {
        apiKey: process.env.BASESCAN_API_KEY || "NS6RISGIKJZC8WV3M7NTEERJMWCXZTBVYU", // Etherscan V2 Unified Key
        customChains: [
            {
                network: "baseSepolia",
                chainId: 84532,
                urls: {
                    apiURL: "https://api-sepolia.basescan.org/api",
                    browserURL: "https://sepolia.basescan.org",
                },
            },
            {
                network: "base",
                chainId: 8453,
                urls: {
                    apiURL: "https://api.basescan.org/api",
                    browserURL: "https://basescan.org",
                },
            },
        ],
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts"
    }
};
