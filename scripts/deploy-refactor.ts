
import { ethers } from "hardhat";

async function main() {
    console.log("---------------------------------------------");
    console.log("Deploying PredictionBattle (Pull Payment Refactor)...");
    console.log("---------------------------------------------");

    // Get the contract factory
    // Note: hardhat-toolbox exposes ethers.getContractFactory automatically
    const PredictionBattle = await ethers.getContractFactory("PredictionBattle");

    console.log("Sending deployment transaction...");
    // Deploy (no constructor args in new contract)
    const predictionBattle = await PredictionBattle.deploy();

    console.log("Waiting for deployment confirmation...");
    await predictionBattle.waitForDeployment();

    const address = await predictionBattle.getAddress();

    console.log("---------------------------------------------");
    console.log(`✅ PredictionBattle deployed to: ${address}`);
    console.log("---------------------------------------------");
    console.log("NEXT STEPS:");
    console.log("1. Update NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local");
    console.log("2. Copy ABI from artifacts/contracts/PredictionBattle.sol/PredictionBattle.json to src/lib/abi/PredictionBattle.json");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
