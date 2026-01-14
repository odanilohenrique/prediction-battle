
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/AdminBetCard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix getBetTypeLabel
const labelStartMarker = 'const getBetTypeLabel = () => {';
const labelEndMarker = 'const handleSubmit = async () => {';

const newLabelLogic = `    const getBetTypeLabel = () => {
        const labels: Record<string, string> = {
            post_count: \`post \${bet.target}+ times\`,
            likes_total: \`get \${bet.target}+ likes\`,
            followers_gain: \`gain \${bet.target}+ followers\`,
            emoji_count: \`use \${bet.target}+ emojis\`,
            mentions: \`get \${bet.target}+ mentions\`,
            quotes: \`get \${bet.target}+ quotes\`,
            reply_marathon: \`post \${bet.target}+ replies\`,
            thread_length: \`make a \${bet.target}+ post thread\`,
            controversial: \`hit \${bet.target}+ controversy score\`,
            word_mentions: \`say "\${bet.wordToMatch || 'WORD'}" \${bet.target}+ times\`,
            comment_count: \`get \${bet.target}+ comments\`,
            ratio: \`get ratioed (replies > likes)\`,
            custom_text: \`\${bet.castText || 'custom bet'}\`,
            versus_battle: \`\${bet.castText || bet.question || 'Battle Prediction'}\`,
        };
        return labels[bet.type] || bet.castText || bet.question || \`hit \${bet.target}\`;
    };

    `;

// Find positions
const labelStart = content.indexOf(labelStartMarker);
const handleSubmitStart = content.indexOf(labelEndMarker);

if (labelStart !== -1 && handleSubmitStart !== -1) {
    console.log('Replacing getBetTypeLabel...');
    // Replace content from start of label function up to start of handleSubmit
    content = content.substring(0, labelStart) + newLabelLogic + content.substring(handleSubmitStart);
} else {
    console.error('Could not find getBetTypeLabel markers');
}

// 2. Fix handleSubmit
const submitEndMarker = 'const handleSeedPool = async () => {';
const newSubmitLogic = `const handleSubmit = async () => {
        if (!isConnected || !address) {
            alert('Please connect your wallet first!');
            return;
        }

        setIsSubmitting(true);
        const submitAmount = parseFloat(amount) || 0;

        try {
            // 0. Verify and Switch Chain
            if (chainId !== EXPECTED_CHAIN_ID) {
                try {
                    console.log(\`Switching chain from \${chainId} to \${EXPECTED_CHAIN_ID}...\`);
                    if (switchChainAsync) {
                        await switchChainAsync({ chainId: EXPECTED_CHAIN_ID });
                    } else {
                        throw new Error("Troca de rede não suportada pela carteira.");
                    }
                } catch (switchError) {
                    console.error('Failed to switch chain:', switchError);
                    showAlert('Wrong Network', \`Please switch to \${IS_MAINNET ? 'Base Mainnet' : 'Base Sepolia'}.\`, 'error');
                    setIsSubmitting(false);
                    return;
                }
            }

            // 1. Approve USDC to Contract
            console.log('Step 1: Approving USDC to contract...');
            const amountInWei = parseUnits(submitAmount.toString(), 6); // USDC has 6 decimals

            let approveHash;
            try {
                approveHash = await writeContractAsync({
                    address: USDC_ADDRESS as \`0x\${string}\`,
                    abi: [{
                        name: 'approve',
                        type: 'function',
                        stateMutability: 'nonpayable',
                        inputs: [
                            { name: 'spender', type: 'address' },
                            { name: 'amount', type: 'uint256' }
                        ],
                        outputs: [{ name: '', type: 'bool' }]
                    }],
                    functionName: 'approve',
                    args: [CURRENT_CONFIG.contractAddress as \`0x\${string}\`, amountInWei],
                    gas: BigInt(100000),
                });
                console.log('Approve tx sent:', approveHash);

                if (!publicClient) throw new Error("Public Client not initialized");
                const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
                if (approveReceipt.status !== 'success') {
                    throw new Error('USDC approval failed on-chain.');
                }
                console.log('Approval confirmed.');

            } catch (txError) {
                console.error('Approval error:', txError);
                const msg = (txError as any).shortMessage || (txError as any).message || 'Wallet Error';
                throw new Error(\`Approval Failed: \${msg}\`);
            }

            // 2. Place Bet on Smart Contract
            console.log('Step 2: Placing bet on contract...');
            let hash;
            try {
                hash = await writeContractAsync({
                    address: CURRENT_CONFIG.contractAddress as \`0x\${string}\`,
                    abi: PredictionBattleABI.abi,
                    functionName: 'placeBet',
                    args: [bet.id, choice === 'yes', amountInWei],
                    gas: BigInt(300000),
                });
                console.log('PlaceBet tx sent:', hash);

                if (!publicClient) throw new Error("Public Client not initialized");
                const receipt = await publicClient.waitForTransactionReceipt({ hash });
                if (receipt.status !== 'success') {
                    throw new Error('Bet placement failed on-chain.');
                }
                console.log('Bet confirmed on-chain:', receipt.transactionHash);

            } catch (txError) {
                console.error('PlaceBet error:', txError);
                const msg = (txError as any).shortMessage || (txError as any).message || 'Wallet Error';
                throw new Error(\`Transaction Failed: \${msg}\`);
            }

            // 3. Call backend to register bet (ONLY AFTER CONFIRMATION)
            console.log('Registering prediction in backend...');
            const response = await fetch('/api/predictions/bet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    betId: bet.id,
                    choice,
                    amount: submitAmount,
                    txHash: hash,
                    userAddress: address
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error Response:', errorText);
                throw new Error(\`Server Error (\${response.status}): Try again.\`);
            }

            const data = await response.json();

            if (data.success) {
                const numericAmount = submitAmount;
                const yesPool = bet.participants.yes.reduce((a, b) => a + b.amount, 0);
                const noPool = bet.participants.no.reduce((a, b) => a + b.amount, 0);
                const initialSeed = bet.initialValue || 0;
                
                // DEAD LIQUIDITY FORMULA
                const seedPerSide = initialSeed / 2;
                const mySideTotal = choice === 'yes' ? yesPool + seedPerSide : noPool + seedPerSide;
                const totalPoolAfterBet = yesPool + noPool + initialSeed + numericAmount;
                const distributablePot = totalPoolAfterBet * 0.75;
                
                // Share = MyBet / (MySideTotal + MyBet)
                const myShare = numericAmount / (mySideTotal + numericAmount);
                const estimatedPayout = myShare * distributablePot;
                
                const multiplier = estimatedPayout / numericAmount;

                // Battle Mode Data
                const isBattle = !!(bet.optionA?.label && bet.optionB?.label);
                let finalChoice = choice === 'yes' ? 'YES' : 'NO';
                let opponentName = '';
                let opponentAvatar = '';
                let myFighterAvatar = '';

                if (isBattle) {
                    if (choice === 'yes') {
                        finalChoice = bet.optionA!.label;
                        myFighterAvatar = bet.optionA!.imageUrl || '';
                        opponentName = bet.optionB!.label;
                        opponentAvatar = bet.optionB!.imageUrl || '';
                    } else {
                        finalChoice = bet.optionB!.label;
                        myFighterAvatar = bet.optionB!.imageUrl || '';
                        opponentName = bet.optionA!.label;
                        opponentAvatar = bet.optionA!.imageUrl || '';
                    }
                }

                setReceiptData({
                    predictionId: bet.id,
                    avatarUrl: bet.pfpUrl, 
                    username: bet.username,
                    action: "JOINED BATTLE",
                    amount: submitAmount,
                    potentialWin: submitAmount * multiplier,
                    multiplier: parseFloat(multiplier.toFixed(2)),
                    choice: finalChoice === 'YES' ? 'YES' : (finalChoice === 'NO' ? 'NO' : finalChoice),
                    targetName: getBetTypeLabel(),
                    variant: isBattle ? 'battle' : 'standard',
                    opponentName: opponentName,
                    opponentAvatar: opponentAvatar,
                    myFighterAvatar: myFighterAvatar
                });

                setShowReceipt(true);
                closeModal(); 
                setIsBattleModalOpen(false); 
            } else {
                showAlert('Partial Error', 'Payment confirmed, but backend registration failed. Please contact support with your TX Hash.', 'warning');
            }
        } catch (error) {
            console.error('Error submitting bet:', error);
            showAlert('Action Failed', (error as Error).message || 'Unknown error occurred', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    `;

// Refind handle submit start (since content changed)
const submitStart = content.indexOf('const handleSubmit = async () => {');
const seedStart = content.indexOf(submitEndMarker);

if (submitStart !== -1 && seedStart !== -1) {
    console.log('Replacing handleSubmit...');
    content = content.substring(0, submitStart) + newSubmitLogic + content.substring(seedStart);
} else {
    console.error('Could not find handleSubmit markers');
}

// 3. Fix Visual Multipliers (Regex Replace)
// Replace the old formula block with the new one
// We look for logic inside the JSX expressions
const oldFormulaRegex = /const losingPool = choice === 'yes' \? noPool : yesPool;[^}]+return \(numericAmount \* multiplier\)\.toFixed\(2\);/s;

const newFormulaLogic = `const initialSeed = bet.initialValue || 0;
                                            const seedPerSide = initialSeed / 2;
                                            const totalPool = yesPool + noPool + initialSeed;
                                            
                                            // Dead Liquidity Visual
                                            // Rate = (TotalPool * 0.75) / (MyEffectiveSide)
                                            // MyEffectiveSide = MySidePool + SeedPerSide
                                            
                                            const mySideCurrent = choice === 'yes' ? yesPool : noPool;
                                            const mySideEffective = mySideCurrent + seedPerSide;
                                            
                                            if (mySideEffective === 0) return '1.75';
                                            
                                            const rate = (totalPool * 0.75) / mySideEffective;
                                            // If numericAmount > 0, we can refine, but for general display rate is enough
                                            
                                            // But wait, the display shows DOLLAR amount first: (numericAmount * multiplier)
                                            if (numericAmount > 0) {
                                                // If betting, allow for slight slippage impact?
                                                // Let's stick to simple current rate for UX simplicity or include bet?
                                                // Including bet is more accurate:
                                                const totalAfter = totalPool + numericAmount;
                                                const sideAfter = mySideEffective + numericAmount;
                                                const payout = (numericAmount / sideAfter) * (totalAfter * 0.75);
                                                return payout.toFixed(2);
                                            }
                                            
                                            return (rate * (numericAmount || 1)).toFixed(2);`;

// Wait, doing regex replace on minified/complex JSX is risky in a script if I don't have the exact string.
// I will skip the regex replace for visual multiplier in this script and do it via `replace_file_content` AFTER the script cleans up the file. 
// The script is mainly to fix the CORRUPTED/DUPLICATED validation logic which is large. 
// Visual multipliers are small blocks I can target later.

fs.writeFileSync(filePath, content, 'utf8');
console.log('AdminBetCard.tsx fixed successfully.');
