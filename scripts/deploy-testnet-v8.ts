const hre = require("hardhat");
const ethers = hre.ethers;
const dotenv = require("dotenv");

// Load local env for testnet
dotenv.config({ path: '.env.local' });

async function main() {
    console.log("🚀 Starting Base Sepolia (Testnet) Deployment...");
    console.log("📦 Contract: PredictionBattleV8 (Audit Fixes)");

    // 1. Get Deployer Wallet (from PRIVATE_KEY in .env.local)
    const [deployer] = await ethers.getSigners();
    console.log(`🔑 Deploying with account: ${deployer.address}`);

    const balance = await deployer.provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

    // 2. Configuration for Base Sepolia
    // V8 has hardcoded USDC for Base Mainnet (0x8335...)
    // For testnet, we need to temporarily change this or use a mock.
    // IMPORTANT: The hardcoded USDC is for MAINNET. For testnet, we need to modify the constant.

    // For testnet, deployer is admin, operator, and treasury
    const ADMIN_ADDRESS = deployer.address;
    const OPERATOR_ADDRESS = deployer.address;
    const TREASURY_ADDRESS = deployer.address;

    console.log("\n📋 Configuration:");
    console.log(`   - Admin:    ${ADMIN_ADDRESS}`);
    console.log(`   - Operator: ${OPERATOR_ADDRESS}`);
    console.log(`   - Treasury: ${TREASURY_ADDRESS}`);
    console.log("   - USDC:     Hardcoded in contract (Base Mainnet)");

    console.log("\n⚠️  NOTE: V8 has hardcoded Base Mainnet USDC.");
    console.log("   For testnet testing, you may need to temporarily modify the constant.");

    console.log("\n⏳ Compiling...");

    // 3. Deploy Contract (V8)
    const PredictionBattle = await ethers.getContractFactory("PredictionBattleV8");

    console.log("⏳ Deploying PredictionBattleV8...");

    // Constructor: (_admin, _operator, _treasury)
    const contract = await PredictionBattle.deploy(ADMIN_ADDRESS, OPERATOR_ADDRESS, TREASURY_ADDRESS);

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log("\n✅ Deployment Successful!");
    console.log(`\n🎉 NEW CONTRACT ADDRESS: ${address}`);
    console.log("\n👇 NEXT STEPS:");
    console.log("1. Update .env.local:");
    console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
    console.log("\n2. Update src/lib/config.ts:");
    console.log(`   TESTNET_CONTRACT_ADDRESS = '${address}'`);
    console.log("\n3. Verify on Basescan:");
    console.log(`   npx hardhat verify --network base-sepolia ${address} ${ADMIN_ADDRESS} ${OPERATOR_ADDRESS} ${TREASURY_ADDRESS}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
