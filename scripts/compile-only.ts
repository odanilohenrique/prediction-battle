
import fs from 'fs';
import path from 'path';
// @ts-ignore
import solc from 'solc';

const CONTRACT_FILENAME = 'PredictionBattleV2.sol';
const CONTRACT_NAME = 'PredictionBattleV2';
const SOURCES_DIR = path.resolve(process.cwd(), 'contracts');
// Saving to BOTH locations to be safe/consistent
const OUTPUT_DIR_1 = path.resolve(process.cwd(), 'src/lib/abi');
const OUTPUT_DIR_2 = path.resolve(process.cwd(), 'src/lib');

async function main() {
    console.log(`Starting compilation for ${CONTRACT_NAME}...`);

    const contractPath = path.join(SOURCES_DIR, CONTRACT_FILENAME);
    const sourceCode = fs.readFileSync(contractPath, 'utf8');

    const input = {
        language: 'Solidity',
        sources: {
            [CONTRACT_FILENAME]: {
                content: sourceCode,
            },
        },
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            viaIR: true,
            outputSelection: {
                '*': {
                    '*': ['*'],
                },
            },
        },
    };

    console.log('Compiling...');
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
        let hasError = false;
        output.errors.forEach((err: any) => {
            if (err.severity === 'error') hasError = true;
            console.error(err.formattedMessage);
        });
        if (hasError) throw new Error('Compilation failed');
    }

    const contract = output.contracts[CONTRACT_FILENAME][CONTRACT_NAME];
    const abi = contract.abi;
    const bytecode = contract.evm.bytecode.object;

    console.log('Compilation successful.');

    // Save 1
    if (!fs.existsSync(OUTPUT_DIR_1)) fs.mkdirSync(OUTPUT_DIR_1, { recursive: true });
    fs.writeFileSync(path.join(OUTPUT_DIR_1, 'PredictionBattle.json'), JSON.stringify({ abi, bytecode }, null, 2));
    console.log(`ABI saved to ${path.join(OUTPUT_DIR_1, 'PredictionBattle.json')}`);

    // Save 2 (as PredictionBattleABI.json to match typical frontend import)
    // Checking naming convention from file search results momentarily
    fs.writeFileSync(path.join(OUTPUT_DIR_2, 'PredictionBattleABI.json'), JSON.stringify({ abi, bytecode }, null, 2));
    console.log(`ABI saved to ${path.join(OUTPUT_DIR_2, 'PredictionBattleABI.json')}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
