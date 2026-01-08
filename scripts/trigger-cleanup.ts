
import fetch from 'node-fetch';

async function main() {
    console.log('Triggering DB Cleanup...');
    try {
        // Assuming running locally on port 3000
        const res = await fetch('http://localhost:3000/api/admin/cleanup', {
            method: 'POST'
        });
        const data = await res.json();
        console.log('Cleanup Result:', data);
    } catch (e) {
        console.error('Error triggering cleanup:', e);
        console.log('NOTE: Ensure the dev server is running (npm run dev) on localhost:3000');
    }
}

main();
