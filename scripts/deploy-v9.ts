const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    // CONFIGURE THESE FOR DEPLOYMENT
    const ADMIN = deployer.address;
    const OPERATOR = deployer.address;
    const TREASURY = deployer.address;

    // NOTE: USDC Address is HARDCODED in the contract for Base Sepolia as per audit remediation.
    // Base Sepolia USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
    // Check contracts/PredictionBattleV9.sol line ~29 if changing networks.

    const PredictionBattle = await ethers.getContractFactory("PredictionBattleV9");

    // Constructor: (address _admin, address _operator, address _treasury, address _usdcToken)
    // Base Sepolia USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
    const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const predictionBattle = await PredictionBattle.deploy(ADMIN, OPERATOR, TREASURY, USDC_ADDRESS);

    await predictionBattle.waitForDeployment();

    const address = await predictionBattle.getAddress();
    console.log("PredictionBattleV9 deployed to:", address);

    console.log("Verifying parameters:");
    console.log("- Admin:", ADMIN);
    console.log("- Operator:", OPERATOR);
    console.log("- Treasury:", TREASURY);
    console.log("- USDC:", USDC_ADDRESS);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
