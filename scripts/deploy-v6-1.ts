import hre from "hardhat";
const { ethers } = hre;
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("Starting deployment for PredictionBattleV6_1...");

    // Addresses
    const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC
    const INITIAL_ADMIN = "0xFA278965A56a16252ccB850d3bB354f6a6E9fB02"; // Requested Admin
    const TREASURY = "0x9E7EDBcBce2fF688297103762B3532E2B40855C8";      // Requested Treasury

    // Verify Deployer
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // Hardcoded check for safety
    const EXPECTED_DEPLOYER = "0x8C451adc05eFDDe2B8cB2F0BA9d7A2223212BECb";
    if (deployer.address.toLowerCase() !== EXPECTED_DEPLOYER.toLowerCase()) {
        console.warn(`WARNING: Deployer address (${deployer.address}) does not match expected (${EXPECTED_DEPLOYER}). Continuing anyway...`);
    }

    console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

    // Compile check (auto-handled by hardhat run usually, but good to know)
    const PredictionBattle = await ethers.getContractFactory("PredictionBattleV6_1");

    console.log("Deploying PredictionBattleV6_1 to Base Sepolia...");
    console.log("Constructor Args:");
    console.log("- USDC:", USDC_ADDRESS);
    console.log("- Admin:", INITIAL_ADMIN);
    console.log("- Treasury:", TREASURY);

    const contract = await PredictionBattle.deploy(USDC_ADDRESS, INITIAL_ADMIN, TREASURY);

    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log("PredictionBattleV6_1 deployed to:", address);

    console.log("\nIMPORTANT: Update your .env.local and config.ts with this new address!");
    console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
