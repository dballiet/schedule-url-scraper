import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

async function debugMinnetonka() {
    console.log('🔎 Debugging Minnetonka Bantam Teams\n');

    const minnetonka = ASSOCIATIONS.find(a => a.name.includes('Minnetonka'));
    if (!minnetonka) {
        console.log('❌ Minnetonka not found');
        return;
    }

    const teams = await scrapeAssociation(minnetonka);

    console.log('\nFound Bantam Teams:');
    const bantamTeams = teams.filter(t => t.team_level === 'Bantams');

    bantamTeams.forEach(t => {
        console.log(`- Name: "${t.name}"`);
        console.log(`  Level Detail: "${t.level_detail}"`);
        console.log(`  URL: ${t.calendar_sync_url}`);
    });

    // Check specifically for Bantam AA vs A
    const bantamAA = teams.find(t => t.name.toLowerCase().includes('bantam') && t.level_detail === 'AA');
    const bantamA = teams.find(t => t.name.toLowerCase().includes('bantam') && t.level_detail === 'A');

    console.log('\nMatching Results:');
    console.log('Bantam AA found:', bantamAA ? 'YES' : 'NO', bantamAA?.calendar_sync_url);
    console.log('Bantam A found:', bantamA ? 'YES' : 'NO', bantamA?.calendar_sync_url);
}

debugMinnetonka().catch(console.error);
