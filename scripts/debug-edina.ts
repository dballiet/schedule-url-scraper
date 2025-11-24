import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

async function debugEdina() {
    const edina = ASSOCIATIONS.find(a => a.name === 'Edina Hockey Association');
    if (!edina) {
        console.error('Edina Hockey Association not found');
        return;
    }

    console.log('Debugging Edina Hockey Association...');
    const teams = await scrapeAssociation(edina);

    console.log('\n--- Filtering Results for Bantam B2 Green ---');
    const targetTeams = teams.filter(t => t.name.toLowerCase().includes('bantam') && t.name.toLowerCase().includes('green'));

    if (targetTeams.length === 0) {
        console.log('No "Bantam B2 Green" teams found.');
    }

    for (const team of targetTeams) {
        console.log(`Team: ${team.name}`);
        console.log(`  URL: ${team.calendar_sync_url}`);
        console.log(`  Level: ${team.team_level} - ${team.level_detail}`);
    }

    console.log('\n--- All Bantam Teams ---');
    const bantamTeams = teams.filter(t => t.team_level === 'Bantams');
    for (const team of bantamTeams) {
        console.log(`Team: ${team.name} | URL: ${team.calendar_sync_url}`);
    }
}

debugEdina();
