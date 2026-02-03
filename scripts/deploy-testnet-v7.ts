const hre = require("hardhat");
const ethers = hre.ethers;
const dotenv = require("dotenv");

// Load local env for testnet
dotenv.config({ path: '.env.local' });

async function main() {
    console.log("🚀 Starting Base Sepolia (Testnet) Deployment...");
    console.log("📦 Contract: PredictionBattleV7_SECURE");

    // 1. Get Deployer Wallet (from PRIVATE_KEY in .env.local)
    const [deployer] = await ethers.getSigners();
    console.log(`🔑 Deploying with account: ${deployer.address}`);

    const balance = await deployer.provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

    // 2. Configuration for Base Sepolia
    const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // USDC on Base Sepolia

    // For testnet, deployer is also admin and treasury
    const ADMIN_ADDRESS = deployer.address;
    const TREASURY_ADDRESS = deployer.address;

    console.log("\n📋 Configuration:");
    console.log(`   - USDC:     ${USDC_ADDRESS}`);
    console.log(`   - Admin:    ${ADMIN_ADDRESS}`);
    console.log(`   - Treasury: ${TREASURY_ADDRESS}`);

    console.log("\n⏳ Compiling...");

    // 3. Deploy Contract (V7 SECURE)
    const PredictionBattle = await ethers.getContractFactory("PredictionBattleV7_SECURE");

    console.log("⏳ Deploying PredictionBattleV7_SECURE...");

    // Constructor: (usdc, initialAdmin, treasury)
    // Note: Owner is set to initialAdmin via Ownable constructor
    const contract = await PredictionBattle.deploy(USDC_ADDRESS, ADMIN_ADDRESS, TREASURY_ADDRESS);

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
    console.log(`   npx hardhat verify --network base-sepolia ${address} ${USDC_ADDRESS} ${TREASURY_ADDRESS}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
