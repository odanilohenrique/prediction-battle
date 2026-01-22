const fs = require('fs');
const path = require('path');
const solc = require('solc');

const contractPath = path.resolve(__dirname, '../contracts/PredictionBattleV3.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
    language: 'Solidity',
    sources: {
        'PredictionBattleV3.sol': {
            content: source
        }
    },
    settings: {
        optimizer: {
            enabled: true,
            runs: 200
        },
        viaIR: true,
        outputSelection: {
            '*': {
                '*': ['*']
            }
        }
    }
};

console.log('Compiling PredictionBattleV3.sol...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
    output.errors.forEach(err => {
        console.error(err.formattedMessage);
    });
    // Don't exit on warnings, only errors
    if (output.errors.some(e => e.severity === 'error')) {
        process.exit(1);
    }
}

const contract = output.contracts['PredictionBattleV3.sol']['PredictionBattleV3'];
const bytecode = contract.evm.bytecode.object;
const abi = contract.abi;

// Save Artifacts
const artifactsDir = path.resolve(__dirname, '../artifacts');
if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir);

fs.writeFileSync(path.join(artifactsDir, 'PredictionBattleV3.bin'), bytecode);
fs.writeFileSync(path.join(artifactsDir, 'PredictionBattleV3.abi'), JSON.stringify(abi, null, 2));

// ALSO replace the frontend V4 ABI with this V3 ABI to fix frontend compatibility
// Because we reverted the frontend code, it might be expecting PredictionBattle.json or V3.json
// But let's check what the frontend imports.
// src/components/CreatePage imports PredictionBattleABI from '@/lib/abi/PredictionBattleV4.json' OR V3?
// Let's save a copy as V4 for safety if imports were already updated before revert?
// Actually, since I did git checkout, imports should be back to OLD paths.
// Let's check imports later. For now just save V3 artifacts.

console.log('Compilation successful!');
console.log('Artifacts saved to:', artifactsDir);
