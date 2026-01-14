
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/AdminBetCard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

console.log('Original length:', content.length);

// 1. Tug of War (YES Side - losingPool = noPool)
const regexYes = /(\s+)\/\/ FIXED multiplier based on CURRENT pool state\s+const losingPool = noPool;[^\}]*return multiplier\.toFixed\(2\);/s;
const replaceYes = `$1// Dead Liquidity Visual
$1const totalPool = yesPool + noPool + initialSeed;
$1const mySideEffective = yesPool + seedPerSide;
$1if (mySideEffective <= 0) return '1.75';
$1const multiplier = (totalPool * 0.75) / mySideEffective;
$1return multiplier.toFixed(2);`;

if (regexYes.test(content)) {
    content = content.replace(regexYes, replaceYes);
    console.log('Replaced Tug of War YES');
} else {
    console.log('Tug of War YES regex not found');
}

// 2. Tug of War (NO Side - losingPool = yesPool)
const regexNo = /(\s+)\/\/ FIXED multiplier based on CURRENT pool state\s+const losingPool = yesPool;[^\}]*return multiplier\.toFixed\(2\);/s;
const replaceNo = `$1// Dead Liquidity Visual
$1const totalPool = yesPool + noPool + initialSeed;
$1const mySideEffective = noPool + seedPerSide;
$1if (mySideEffective <= 0) return '1.75';
$1const multiplier = (totalPool * 0.75) / mySideEffective;
$1return multiplier.toFixed(2);`;

if (regexNo.test(content)) {
    content = content.replace(regexNo, replaceNo);
    console.log('Replaced Tug of War NO');
} else {
    console.log('Tug of War NO regex not found');
}

// 3. Summary Payout (Uppercase FIXED MULTIPLIER)
const regexSummary = /(\s+)\/\/ FIXED MULTIPLIER based on CURRENT pool state[^\}]*return \(numericAmount \* multiplier\)\.toFixed\(2\);/s;
const replaceSummary = `$1// Dead Liquidity Visual
$1const totalPool = yesPool + noPool + initialSeed;
$1const mySideCurrent = choice === 'yes' ? yesPool : noPool;
$1const mySideEffective = mySideCurrent + seedPerSide;
$1if (mySideEffective <= 0) return (numericAmount * 1.75).toFixed(2);
$1const rate = (totalPool * 0.75) / mySideEffective;
$1return (numericAmount * rate).toFixed(2);`;

if (regexSummary.test(content)) {
    content = content.replace(regexSummary, replaceSummary);
    console.log('Replaced Summary Payout');
} else {
    console.log('Summary Payout regex not found');
}

// 4. Summary Rate (Parentheses - No comment)
// Find block starting with const losingPool and ending with multiplier.toFixed(2) inside the parens area
const regexRate = /(\s+)const losingPool = choice === 'yes' \? noPool : yesPool;[^\}]*return multiplier\.toFixed\(2\);/s;
const replaceRate = `$1const totalPool = yesPool + noPool + initialSeed;
$1const mySideCurrent = choice === 'yes' ? yesPool : noPool;
$1const mySideEffective = mySideCurrent + seedPerSide;
$1if (mySideEffective <= 0) return '1.75';
$1const rate = (totalPool * 0.75) / mySideEffective;
$1return rate.toFixed(2);`;

if (regexRate.test(content)) {
    content = content.replace(regexRate, replaceRate);
    console.log('Replaced Summary Rate');
} else {
    console.log('Summary Rate regex not found');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Final length:', content.length);
