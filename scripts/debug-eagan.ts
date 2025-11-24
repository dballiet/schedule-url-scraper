import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

async function debugEagan() {
    const eagan = ASSOCIATIONS.find(a => a.name === 'Eagan Hockey Association');
    if (!eagan) {
        console.error('Eagan Hockey Association not found');
        return;
    }

    console.log('Debugging Eagan Hockey Association...');
    const teams = await scrapeAssociation(eagan);

    console.log('\n--- Filtering Results for Bantam C ---');
    const bantamCTeams = teams.filter(t => t.name.includes('Bantam C') || t.team_level === 'Bantams');

    for (const team of bantamCTeams) {
        console.log(`Team: ${team.name}`);
        console.log(`  URL: ${team.calendar_sync_url}`);
        console.log(`  Level: ${team.team_level} - ${team.level_detail}`);
    }
}

debugEagan();
