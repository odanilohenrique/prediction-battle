const fs = require('fs');
const path = require('path');

const abiPath = path.resolve(__dirname, '../src/lib/abi/PredictionBattle.json');

try {
    const content = fs.readFileSync(abiPath, 'utf8');
    const json = JSON.parse(content);

    if (Array.isArray(json)) {
        console.log('Detected Array ABI. Wrapping in object...');
        const newContent = { abi: json };
        fs.writeFileSync(abiPath, JSON.stringify(newContent, null, 2));
        console.log('✅ ABI fixed: Wrapped in { abi: [...] }');
    } else if (json.abi && Array.isArray(json.abi)) {
        console.log('✅ ABI is already in correct format { abi: [...] }');
    } else {
        console.error('❌ Unknown ABI format');
    }
} catch (error) {
    console.error('Error fixing ABI:', error);
}
