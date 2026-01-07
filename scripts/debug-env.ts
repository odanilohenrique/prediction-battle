
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
console.log(`Reading: ${envPath}`);

if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    console.log('--- Keys Found ---');
    content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        const [key, ...rest] = trimmed.split('=');
        if (key) {
            const keyName = key.trim();
            const val = rest.join('=');
            const hasValue = rest.length > 0;
            // Mask value for log
            const displayLen = val ? val.length : 0;
            console.log(`Key: "${keyName}" | HasValue: ${hasValue} | ValLength: ${displayLen}`);
        }
    });
    console.log('------------------');
} else {
    console.log('File not found');
}
