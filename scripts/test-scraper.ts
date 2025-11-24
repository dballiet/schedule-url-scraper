import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

import * as fs from 'fs';

async function runTests() {
    console.log('Starting Acceptance Tests...');
    const results: any = {};

    // Test 1 & 2: Anoka
    const anoka = ASSOCIATIONS.find(a => a.name.includes('Anoka'));
    if (anoka) {
        console.log('\nTesting Anoka...');
        const teams = await scrapeAssociation(anoka);

        const bantamA = teams.find(t => t.name.toLowerCase().includes('bantam a'));
        const squirtB1 = teams.find(t => t.name.toLowerCase().includes('squirt b1'));

        results.anoka = {
            bantamA: bantamA ? { found: true, url: bantamA.calendar_sync_url } : { found: false },
            squirtB1: squirtB1 ? { found: true, url: squirtB1.calendar_sync_url } : { found: false },
            totalTeams: teams.length
        };
    }

    // Test 3: CCHA
    const ccha = ASSOCIATIONS.find(a => a.name.includes('Chaska Chanhassen'));
    if (ccha) {
        console.log('\nTesting CCHA...');
        const teams = await scrapeAssociation(ccha);

        const squirtB1Gold = teams.find(t => t.name.toLowerCase().includes('squirt b1 gold'));

        results.ccha = {
            squirtB1Gold: squirtB1Gold ? { found: true, url: squirtB1Gold.calendar_sync_url } : { found: false }
        };
    }

    fs.writeFileSync('test_results.json', JSON.stringify(results, null, 2));
    console.log('Tests complete. Results written to test_results.json');
}

runTests().catch(console.error);
