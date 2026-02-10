
const { ethers, network } = require("hardhat");
const assert = require("assert");

async function main() {
    console.log("Running Verification for Parimutuel Fix...");

    // Setup
    const [owner, otherAccount, creator, reporter, earlyBettor, whaleBettor] = await ethers.getSigners();
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

    const PredictionBattle = await ethers.getContractFactory("PredictionBattleV9");
    // Constructor: (admin, operator, treasury, usdc)
    const battle = await PredictionBattle.deploy(owner.address, owner.address, owner.address, usdcAddress);
    await battle.waitForDeployment();
    const battleAddress = await battle.getAddress();

    // Mint USDC
    const amount = ethers.parseUnits("10000", 6);
    await usdc.mint(creator.address, amount);
    await usdc.mint(earlyBettor.address, amount);
    await usdc.mint(whaleBettor.address, amount);

    // Approve
    const maxUint = ethers.MaxUint256;
    await usdc.connect(creator).approve(battleAddress, maxUint);
    await usdc.connect(earlyBettor).approve(battleAddress, maxUint);
    await usdc.connect(whaleBettor).approve(battleAddress, maxUint);

    // Create Market
    const marketId = "market-parimutuel-test-" + Date.now();
    const seed = ethers.parseUnits("10", 6);
    await battle.connect(creator).createMarket(marketId, "Parimutuel Test?", seed, 3600, 60);

    // 1. Early Bettor bets 100 USDC on YES
    const earlyBet = ethers.parseUnits("100", 6);
    await battle.connect(earlyBettor).placeBet(marketId, true, earlyBet, 0, ethers.ZeroAddress);
    console.log("  - Early Bettor placed 100 USDC");

    // 2. Whale bets 1000 USDC on YES
    const whaleBet = ethers.parseUnits("1000", 6);
    await battle.connect(whaleBettor).placeBet(marketId, true, whaleBet, 0, ethers.ZeroAddress);
    console.log("  - Whale Bettor placed 1000 USDC");

    // Check Shares
    // We need to read shares from events or a getter. V9 removed getters for specific bets, but we can verify totalSharesYes.
    // However, let's look at the result.

    // Total Pool YES = 1100.
    // Early Bettor should have ~9% of shares. Whale ~91%.
    // In old buggy version: Early would have X shares based on odds 1.0. Whale would have Y shares based on Odds 1.0 (since NO side is empty/seed is separate).
    // Wait, if NO side is 0, odds are infinite? Code handled that: "if yesPool == 0 return amount".
    // But if NO side has 10 (seed)? Ah seed is separate now in V9!
    // So YES pool = 0. NO pool = 0.
    // Early bet -> YES pool = 100. Odds = ?

    // Let's just create a NO bet to make it realistic.
    await battle.connect(creator).placeBet(marketId, false, ethers.parseUnits("100", 6), 0, ethers.ZeroAddress);
    console.log("  - Opponent placed 100 USDC on NO");

    // Now resolve YES and check payouts.
    // Total Pool = 100 (Early) + 1000 (Whale) + 100 (Opponent) = 1200.
    // Winners: Early + Whale.
    // Early Put 100. Whale Put 1000.
    // Ratio 1:10.

    // Fast forward
    await network.provider.send("evm_increaseTime", [3601]);
    await network.provider.send("evm_mine");

    // Resolve YES
    const bond = ethers.parseUnits("20", 6);
    // Grant operator role to resolve directly or use adminResolve
    await battle.adminResolve(marketId, 1); // YES
    console.log("  - Resolved YES");

    // Check Balance Changes
    const balanceBeforeEarly = await usdc.balanceOf(earlyBettor.address);
    const balanceBeforeWhale = await usdc.balanceOf(whaleBettor.address);

    await battle.connect(earlyBettor).claimWinnings(marketId);
    await battle.connect(whaleBettor).claimWinnings(marketId);

    const balanceAfterEarly = await usdc.balanceOf(earlyBettor.address);
    const balanceAfterWhale = await usdc.balanceOf(whaleBettor.address);

    const profitEarly = balanceAfterEarly - balanceBeforeEarly;
    const profitWhale = balanceAfterWhale - balanceBeforeWhale;

    console.log(`  - Early Payout: ${ethers.formatUnits(profitEarly, 6)} USDC`);
    console.log(`  - Whale Payout: ${ethers.formatUnits(profitWhale, 6)} USDC`);

    // Expected:
    // Total Pot = 1200.
    // Fees = 21% = 252.
    // Net Pot = 948.
    // Early Share = 100/1100 = 9.09% -> ~86.18 USDC
    // Whale Share = 1000/1100 = 90.90% -> ~861.81 USDC
    // Wait, they lost money? Yes, because NO side was small (100) and fees (21%) ate the profit.
    // But ratio should be correct!
    // Whale Payout should be exactly 10x Early Payout.

    const ratio = Number(profitWhale) / Number(profitEarly);
    console.log(`  - Payout Ratio (Whale/Early): ${ratio}`);

    // Allow small rounding error
    assert(ratio > 9.9 && ratio < 10.1, "Ratio is not 10:1 ! Parimutuel logic is broken.");

    console.log("\n✅ Parimutuel Logic Verified: Payouts are proportional to bet amount.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
