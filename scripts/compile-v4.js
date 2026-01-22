/**
 * Compile V4 using Solidity JSON input (supports via-ir)
 */

const solc = require('solc');
const fs = require('fs');
const path = require('path');

const contractPath = path.join(__dirname, '../contracts/PredictionBattleV4.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
    language: 'Solidity',
    sources: {
        'PredictionBattleV4.sol': {
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

console.log('Compiling with via-ir optimization...');

const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
    output.errors.forEach(err => {
        console.log(err.formattedMessage);
    });

    const hasError = output.errors.some(e => e.severity === 'error');
    if (hasError) {
        console.error('\n❌ Compilation failed with errors');
        process.exit(1);
    }
}

const contract = output.contracts['PredictionBattleV4.sol']['PredictionBattleV4'];

if (!contract) {
    console.error('❌ Contract not found in output');
    process.exit(1);
}

const outputDir = path.join(__dirname, '../artifacts');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(
    path.join(outputDir, 'PredictionBattleV4.bin'),
    contract.evm.bytecode.object
);

fs.writeFileSync(
    path.join(outputDir, 'PredictionBattleV4.abi'),
    JSON.stringify(contract.abi, null, 2)
);

console.log('✅ Compilation successful!');
console.log('📄 Bytecode size:', (contract.evm.bytecode.object.length / 2), 'bytes');
console.log('📄 ABI written to artifacts/PredictionBattleV4.abi');
console.log('📄 Bytecode written to artifacts/PredictionBattleV4.bin');
