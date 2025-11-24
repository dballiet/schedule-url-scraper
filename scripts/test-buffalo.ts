import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

async function runTests() {
    const buffalo = ASSOCIATIONS.find(a => a.name.includes('Buffalo'));
    if (!buffalo) {
        console.error('Buffalo not found!');
        return;
    }

    console.log('Testing Buffalo Hockey Association...\n');
    const teams = await scrapeAssociation(buffalo);

    const squirtB1 = teams.find(t => t.team_level === 'Squirts' && t.level_detail.toLowerCase().includes('b1'));
    const bantamB2 = teams.find(t => t.team_level === 'Bantams' && t.level_detail.toLowerCase().includes('b2'));
    const peeweeAA = teams.find(t => t.team_level === 'Peewees' && t.level_detail.toLowerCase().includes('aa'));

    console.log('=== Results ===\n');

    console.log('Squirt B1:');
    console.log(`  Expected: webcal://buffalo.pucksystems2.com/ical_feed?tags=9147098`);
    console.log(`  Found:    ${squirtB1 ? squirtB1.calendar_sync_url : 'NOT FOUND'}`);
    console.log(`  Match:    ${squirtB1?.calendar_sync_url === 'webcal://buffalo.pucksystems2.com/ical_feed?tags=9147098' ? '✓' : '✗'}\n`);

    console.log('Bantam B2:');
    console.log(`  Expected: webcal://buffalo.pucksystems2.com/ical_feed?tags=9135406`);
    console.log(`  Found:    ${bantamB2 ? bantamB2.calendar_sync_url : 'NOT FOUND'}`);
    console.log(`  Match:    ${bantamB2?.calendar_sync_url === 'webcal://buffalo.pucksystems2.com/ical_feed?tags=9135406' ? '✓' : '✗'}\n`);

    console.log('Peewee AA:');
    console.log(`  Found:    ${peeweeAA ? peeweeAA.calendar_sync_url : 'NOT FOUND'}\n`);

    console.log(`\nTotal teams found: ${teams.length}`);
}

runTests().catch(console.error);
