import { ethers } from "hardhat";
import * as dotenv from "dotenv";

// Load specific env file for production if needed, or rely on hardhat's loading
dotenv.config({ path: '.env.production' });

async function main() {
    console.log("🚀 Starting Mainnet Deployment...");

    // 1. Get Deployer Wallet (from PRIVATE_KEY in .env)
    const [deployer] = await ethers.getSigners();
    console.log(`🔑 Deploying with account: ${deployer.address}`);

    const balance = await deployer.provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

    // 2. Configuration for Base Mainnet
    const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base Mainnet USDC

    // These should be your COLD WALLETS / LEDGERS
    const ADMIN_ADDRESS = process.env.MAINNET_ADMIN_ADDRESS;
    const TREASURY_ADDRESS = process.env.MAINNET_TREASURY_ADDRESS;

    if (!ADMIN_ADDRESS || !TREASURY_ADDRESS) {
        throw new Error("❌ Missing MAINNET_ADMIN_ADDRESS or MAINNET_TREASURY_ADDRESS in .env file");
    }

    console.log("\n📋 Configuration:");
    console.log(`   - USDC:     ${USDC_ADDRESS}`);
    console.log(`   - Admin:    ${ADMIN_ADDRESS} (Hardware Wallet)`);
    console.log(`   - Treasury: ${TREASURY_ADDRESS} (Cold Storage)`);

    console.log("\n⏳ Deploying PredictionBattleV7_SECURE...");

    // 3. Deploy Contract (V7 SECURE)
    const PredictionBattle = await ethers.getContractFactory("PredictionBattleV7_SECURE");
    // Constructor: (usdc, admin, treasury)
    // We set the Hardware Wallets DIRECTLY in the constructor for maximum security.
    const contract = await PredictionBattle.deploy(USDC_ADDRESS, ADMIN_ADDRESS, TREASURY_ADDRESS);

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log("\n✅ Deployment Successful!");
    console.log(`👉 Contract Address: ${address}`);
    console.log("\n👇 UP NEXT:");
    console.log("1. Verify contract on Basescan:");
    console.log(`   npx hardhat verify --network base-mainnet ${address} ${USDC_ADDRESS} ${ADMIN_ADDRESS} ${TREASURY_ADDRESS}`);
    console.log("2. Update .env.production and Vercel with the new NEXT_PUBLIC_CONTRACT_ADDRESS.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
