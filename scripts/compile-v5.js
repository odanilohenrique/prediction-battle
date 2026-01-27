const fs = require('fs');
const path = require('path');
const solc = require('solc');

const contractPath = path.resolve(__dirname, '../contracts/PredictionBattleV5.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
    language: 'Solidity',
    sources: {
        'PredictionBattleV5.sol': {
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

console.log('Compiling PredictionBattleV5.sol...');
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

const contract = output.contracts['PredictionBattleV5.sol']['PredictionBattleV5'];
const bytecode = contract.evm.bytecode.object;
const abi = contract.abi;

// Save Artifacts
const artifactsDir = path.resolve(__dirname, '../artifacts');
if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir);

fs.writeFileSync(path.join(artifactsDir, 'PredictionBattleV5.bin'), bytecode);
fs.writeFileSync(path.join(artifactsDir, 'PredictionBattleV5.abi'), JSON.stringify(abi, null, 2));

console.log('Compilation successful!');
console.log('Artifacts saved to:', artifactsDir);
