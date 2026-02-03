const hre = require("hardhat");
const ethers = hre.ethers;
const styles = {
    success: "\x1b[32m%s\x1b[0m",
    fail: "\x1b[31m%s\x1b[0m",
    info: "\x1b[36m%s\x1b[0m"
};

async function main() {
    console.log(styles.info, "🔍 Starting V7 Live Verification on Base Sepolia...");

    // 1. Setup
    const [signer] = await ethers.getSigners();
    const CONTRACT_ADDRESS = "0xa41682332F792DC03D3191405CBaeC2D36AF4989"; // V7 Deployed
    const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const MARKET_ID = "v7-test-" + Math.floor(Math.random() * 100000);

    const contract = await ethers.getContractAt("PredictionBattleV7_SECURE", CONTRACT_ADDRESS, signer);
    // Use fully qualified name to avoid ambiguity
    const usdc = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDC_ADDRESS, signer);

    console.log(`👤 User: ${signer.address}`);
    console.log(`📝 Contract: ${CONTRACT_ADDRESS}`);
    console.log(`🆔 Test Market ID: ${MARKET_ID}`);

    // Approve USDC if needed
    const allowance = await usdc.allowance(signer.address, CONTRACT_ADDRESS);
    if (allowance < ethers.parseUnits("1000", 6)) {
        console.log("🔓 Approving USDC...");
        await (await usdc.approve(CONTRACT_ADDRESS, ethers.MaxUint256)).wait();
    }

    // ====================================================
    // TEST 1: Early Bird Bonus (Time-Based Weight)
    // ====================================================
    console.log(styles.info, "\n🧪 TEST 1: Early Bird Bonus");

    // Create Market with VERY SHORT bonus duration (10 blocks = ~20 seconds on Base)
    // Seed: 2 USDC (min even amount)
    // Duration: 1 hour
    // Bonus: 30 blocks (~1 min)
    try {
        console.log("Creating market...");
        await (await contract.createMarket(
            MARKET_ID,
            "Will V7 pass verification?",
            ethers.parseUnits("2", 6),
            3600, // Duration
            30    // Bonus Duration (Small window for testing)
        )).wait();
        console.log(styles.success, "✅ Market Created");

        // SETUP: Place a bet on YES to imbalance the pool
        console.log("Setup: Placing bet on YES to create imbalance...");
        await (await contract.placeBet(
            MARKET_ID,
            true, // YES
            ethers.parseUnits("10", 6), // Large bet to shift odds
            0,
            ethers.ZeroAddress
        )).wait();

        // BET: Place EARLY bet on NO (Contrarian) - Should get Bonus
        console.log("Placing CONTRARIAN bet on NO (Should have Weight > 100)...");
        const betTx1 = await contract.placeBet(
            MARKET_ID,
            false, // NO
            ethers.parseUnits("1", 6),
            0, // MinShares (ignore for now)
            ethers.ZeroAddress
        );
        const receipt1 = await betTx1.wait();

        // Find BetPlaced event
        const event1 = receipt1.logs.find(log => {
            try { return contract.interface.parseLog(log)?.name === "BetPlaced"; }
            catch { return false; }
        });
        const weight1 = contract.interface.parseLog(event1).args.weight;
        console.log(`Early Contrarian Weight: ${weight1}`);

        if (weight1 > 100n) console.log(styles.success, "✅ Early Bird Bonus Applied!");
        else console.log(styles.fail, "❌ Failed: No bonus applied on contrarian bet.");

    } catch (e) {
        console.log(styles.fail, "❌ Test 1 Failed: " + e.message);
    }

    // ====================================================
    // TEST 2: MEV Protection (Slippage)
    // ====================================================
    console.log(styles.info, "\n🧪 TEST 2: MEV / Slippage Revert");

    try {
        console.log("Attempting bet with Impossible Slippage (minShares = Infinity)...");

        // Try to ask for more shares than possible
        await contract.placeBet(
            MARKET_ID,
            true,
            ethers.parseUnits("1", 6),
            ethers.parseUnits("999999", 18), // Impossible amount of shares
            ethers.ZeroAddress
        );

        console.log(styles.fail, "❌ Failed: Transaction did NOT revert!");
    } catch (e) {
        if (e.message.includes("Slippage") || e.message.includes("execution reverted")) {
            console.log(styles.success, "✅ SUCCESS: Transaction reverted as expected (Slippage protection working).");
        } else {
            console.log(styles.fail, "❌ Failed with unexpected error: " + e.message);
        }
    }

    // ====================================================
    // TEST 3: Bond Validation (Min 5 USDC)
    // ====================================================
    console.log(styles.info, "\n🧪 TEST 3: Bond Validation (Min 5 USDC)");

    try {
        // We need the market to be ended to propose. This is hard to test on live net without waiting 1 hour.
        // We will skip the execution but we can verify the getRequiredBond view function.

        const requiredBond = await contract.getRequiredBond(MARKET_ID);
        console.log(`Required Bond for current pool: ${ethers.formatUnits(requiredBond, 6)} USDC`);

        if (requiredBond >= ethers.parseUnits("5", 6)) {
            console.log(styles.success, "✅ getRequiredBond returns >= 5 USDC");
        } else {
            console.log(styles.fail, "❌ getRequiredBond is too low!");
        }

    } catch (e) {
        console.log(styles.fail, "❌ Test 3 Failed: " + e.message);
    }

    console.log(styles.info, "\n🏁 Verification Complete.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
