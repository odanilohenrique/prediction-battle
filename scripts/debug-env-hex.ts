
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
console.log(`Reading: ${envPath}`);

if (fs.existsSync(envPath)) {
    const buffer = fs.readFileSync(envPath);
    console.log('First 20 bytes (hex):', buffer.slice(0, 20).toString('hex'));

    const content = buffer.toString('utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
        if (line.toUpperCase().includes('PRIVATE')) {
            console.log(`\nLine ${idx}:`);
            console.log('Raw (first 100 chars):', JSON.stringify(line.slice(0, 100)));
            console.log('Char codes:', [...line.slice(0, 20)].map(c => c.charCodeAt(0)));
        }
    });
} else {
    console.log('File not found');
}
