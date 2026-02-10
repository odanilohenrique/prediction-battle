
const { ethers, network } = require("hardhat");
const assert = require("assert");

async function increaseTime(seconds) {
    await network.provider.send("evm_increaseTime", [seconds]);
    await network.provider.send("evm_mine");
}

async function main() {
    console.log("Running Verification for C-01: Insolvency in DRAW...");

    // Setup
    const [owner, otherAccount, creator, reporter, bettor1, bettor2, challenger] = await ethers.getSigners();
    console.log("  - Signers ready");

    let USDC;
    try {
        USDC = await ethers.getContractFactory("PredictionBattleUSDC");
    } catch (e) {
        console.log("PredictionBattleUSDC not found");
        throw e;
    }
    const usdc = await USDC.deploy();
    await usdc.waitForDeployment();
    const usdcAddress = await usdc.getAddress();
    console.log("  - Mock USDC Deployed:", usdcAddress);

    const PredictionBattle = await ethers.getContractFactory("PredictionBattleV9");
    const battle = await PredictionBattle.deploy(owner.address, owner.address, owner.address, usdcAddress);
    await battle.waitForDeployment();
    const battleAddress = await battle.getAddress();
    console.log("  - PredictionBattleV9 Deployed:", battleAddress);

    // Mint USDC
    const amount = ethers.parseUnits("1000", 6);
    await usdc.mint(creator.address, amount);
    await usdc.mint(bettor1.address, amount);
    await usdc.mint(bettor2.address, amount);
    await usdc.mint(reporter.address, amount);
    await usdc.mint(challenger.address, amount);
    console.log("  - USDC Minted");

    // Approve
    const maxUint = ethers.MaxUint256;
    await usdc.connect(creator).approve(battleAddress, maxUint);
    await usdc.connect(bettor1).approve(battleAddress, maxUint);
    await usdc.connect(bettor2).approve(battleAddress, maxUint);
    await usdc.connect(reporter).approve(battleAddress, maxUint);
    await usdc.connect(challenger).approve(battleAddress, maxUint);
    console.log("  - USDC Approved");

    // Verify C-01
    const marketId = "market-draw-test-" + Date.now();
    const seed = ethers.parseUnits("10", 6);
    await battle.connect(creator).createMarket(marketId, "Will it draw?", seed, 3600, 60);
    console.log("  - Market Created");

    const betAmount = ethers.parseUnits("100", 6);
    await battle.connect(bettor1).placeBet(marketId, true, betAmount, 0, ethers.ZeroAddress);
    await battle.connect(bettor2).placeBet(marketId, false, betAmount, 0, ethers.ZeroAddress);
    console.log("  - Bets Placed");

    await increaseTime(3601);

    const bond = ethers.parseUnits("7", 6);
    await battle.connect(reporter).proposeOutcome(marketId, true, "url", bond);
    console.log("  - Outcome Proposed");

    await battle.adminResolve(marketId, 3); // DRAW
    console.log("  - Admin Resolved as DRAW");

    // Check Solvency: Claim Winnings
    try {
        await battle.connect(bettor1).claimWinnings(marketId);
        console.log("    ✅ Bettor 1 Claimed Successfully");
    } catch (e) {
        console.error("    ❌ Bettor 1 Claim Failed:", e.message);
        process.exit(1);
    }

    try {
        await battle.connect(bettor2).claimWinnings(marketId);
        console.log("    ✅ Bettor 2 Claimed Successfully");
    } catch (e) {
        console.error("    ❌ Bettor 2 Claim Failed:", e.message);
        process.exit(1);
    }

    try {
        await battle.connect(reporter).claimReporterReward(marketId);
        console.log("    ✅ Reporter Claimed Reward Successfully");
    } catch (e) {
        console.error("    ❌ Reporter Claim Failed:", e.message);
        process.exit(1);
    }

    console.log("\n✅ C-01 Solvency Check Passed: All claims processed successfully in DRAW scenario.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
