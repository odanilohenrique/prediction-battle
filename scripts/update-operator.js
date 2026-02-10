const hre = require("hardhat");

async function main() {
    const contractAddress = "0x5b9B8d0D9FE601c5B0fF64ef69B5DD7DC1542a3a";
    const newOperator = "0xFA278965A56a16252ccB850d3bB354f6a6E9fB02";

    console.log("Updating operator on contract:", contractAddress);
    console.log("New Operator:", newOperator);

    const PredictionBattle = await hre.ethers.getContractFactory("PredictionBattleV9");
    const contract = PredictionBattle.attach(contractAddress);

    // Get current operator
    // The contract has a public variable `currentOperator` or `operator`?
    // Let's check if it exposes `currentOperator` public var.
    // The file `PredictionBattleV9.sol` line 167: `address public currentOperator;`
    // And line 21 calls `OPERATOR_ROLE`.
    // Wait, I saw `currentOperator` in source line 167.

    try {
        const current = await contract.currentOperator();
        console.log("Current Operator:", current);

        if (current.toLowerCase() === newOperator.toLowerCase()) {
            console.log("Operator already set correctly.");
            return;
        }
    } catch (e) {
        console.log("Could not read currentOperator, trying to proceed anyway...");
    }

    try {
        const tx = await contract.setOperator(newOperator);
        console.log("Transaction sent:", tx.hash);
        await tx.wait();
        console.log("Transaction confirmed!");
    } catch (error) {
        console.error("Error setting operator:", error);
    }

    const updated = await contract.currentOperator();
    console.log("Updated Operator:", updated);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
