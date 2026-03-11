const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying PredictionBattleV10 with account:", deployer.address);

    const ADMIN = deployer.address;
    const OPERATOR = "0xFbb847E4bA555fa38C737CAA3E3591B6448cE987"; // New Operator
    const TREASURY = "0x9E7EDBcBce2fF688297103762B3532E2B40855C8"; // New Treasury
    const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC

    const PredictionBattle = await ethers.getContractFactory("PredictionBattleV10");
    const predictionBattle = await PredictionBattle.deploy(ADMIN, OPERATOR, TREASURY, USDC_ADDRESS);

    await predictionBattle.waitForDeployment();

    const address = await predictionBattle.getAddress();
    console.log("PredictionBattleV10 deployed to:", address);

    console.log("Parameters:");
    console.log("- Admin:", ADMIN);
    console.log("- Operator:", OPERATOR);
    console.log("- Treasury:", TREASURY);
    console.log("- USDC:", USDC_ADDRESS);

    console.log("\n--- NEXT STEPS ---");
    console.log(`1. Update .env.local: NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
    console.log(`2. Verify:  npx hardhat verify --network baseSepolia ${address} ${ADMIN} ${OPERATOR} ${TREASURY} ${USDC_ADDRESS}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
