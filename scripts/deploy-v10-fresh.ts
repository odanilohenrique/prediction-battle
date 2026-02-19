const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying PredictionBattleV10 with account:", deployer.address);

    // First, cancel any stuck pending tx by sending a self-transfer at same nonce with higher gas
    const pendingNonce = await ethers.provider.getTransactionCount(deployer.address, "pending");
    const latestNonce = await ethers.provider.getTransactionCount(deployer.address, "latest");
    console.log(`Nonce check: pending=${pendingNonce}, latest=${latestNonce}`);

    if (pendingNonce > latestNonce) {
        console.log("Found stuck pending tx(es). Sending cancel tx(es)...");
        for (let n = latestNonce; n < pendingNonce; n++) {
            const cancelTx = await deployer.sendTransaction({
                to: deployer.address,
                value: 0,
                nonce: n,
                maxFeePerGas: ethers.parseUnits("5", "gwei"),
                maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
            });
            console.log(`Cancel tx at nonce ${n}: ${cancelTx.hash}`);
            await cancelTx.wait();
            console.log(`Cancel tx at nonce ${n} confirmed.`);
        }
    }

    const ADMIN = deployer.address;
    const OPERATOR = "0xFA278965A56a16252ccB850d3bB354f6a6E9fB02";
    const TREASURY = deployer.address;
    const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC

    console.log("\nDeploying contract...");
    const PredictionBattle = await ethers.getContractFactory("PredictionBattleV10");
    const predictionBattle = await PredictionBattle.deploy(ADMIN, OPERATOR, TREASURY, USDC_ADDRESS, {
        maxFeePerGas: ethers.parseUnits("5", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
    });

    await predictionBattle.waitForDeployment();

    const address = await predictionBattle.getAddress();
    console.log("\n✅ PredictionBattleV10 deployed to:", address);

    console.log("Parameters:");
    console.log("- Admin:", ADMIN);
    console.log("- Operator:", OPERATOR);
    console.log("- Treasury:", TREASURY);
    console.log("- USDC:", USDC_ADDRESS);

    console.log("\n--- NEXT STEPS ---");
    console.log(`1. Update .env.local: NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
    console.log(`2. Update config.ts with new address`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
