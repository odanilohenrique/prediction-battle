
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config({ path: ".env.local" });

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
    },
    etherscan: {
        apiKey: {
            baseSepolia: process.env.BASESCAN_API_KEY || "PLACEHOLDER",
        },
        customChains: [
            {
                network: "baseSepolia",
                chainId: 84532,
                urls: {
                    apiURL: "https://api-sepolia.basescan.org/api",
                    browserURL: "https://sepolia.basescan.org",
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
