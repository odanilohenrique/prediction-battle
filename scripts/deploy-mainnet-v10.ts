const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🚀 Deploying PredictionBattleV10 to BASE MAINNET");
    console.log("🔑 Deployer:", deployer.address);

    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("💰 ETH Balance:", ethers.formatEther(balance), "ETH");

    if (balance < ethers.parseEther("0.001")) {
        throw new Error("❌ Insufficient ETH. Need at least 0.001 ETH for deploy.");
    }

    // === MAINNET ADDRESSES ===
    const ADMIN = "0x45b2B729aF1f7EdeEb74Ce99949c27f9717157C5"; // Deployer = Admin
    const OPERATOR = "0xFA278965A56a16252ccB850d3bB354f6a6E9fB02"; // Backend Operator
    const TREASURY = "0x9E7EDBcBce2fF688297103762B3532E2B40855C8"; // Treasury Safe
    const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base Mainnet USDC

    console.log("\n📋 Constructor Parameters:");
    console.log("  Admin:    ", ADMIN);
    console.log("  Operator: ", OPERATOR);
    console.log("  Treasury: ", TREASURY);
    console.log("  USDC:     ", USDC);

    console.log("\n⏳ Deploying contract...");
    const Factory = await ethers.getContractFactory("PredictionBattleV10");
    const contract = await Factory.deploy(ADMIN, OPERATOR, TREASURY, USDC, {
        // Base Mainnet gas settings
        maxFeePerGas: ethers.parseUnits("0.5", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("0.05", "gwei"),
    });

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log("\n✅ ============================");
    console.log("✅ CONTRACT DEPLOYED!");
    console.log("✅ Address:", address);
    console.log("✅ ============================");

    console.log("\n📝 NEXT STEPS:");
    console.log(`1. Verify: npx hardhat verify --network base ${address} ${ADMIN} ${OPERATOR} ${TREASURY} ${USDC}`);
    console.log(`2. Update Vercel env: NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
    console.log(`3. Update Vercel env: NEXT_PUBLIC_USE_MAINNET=true`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => { console.error(error); process.exit(1); });
