
require("@nomicfoundation/hardhat-ethers");
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
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts"
    }
};
