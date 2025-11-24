import { associations } from '../src/lib/associations';
import { scrapeAssociation } from '../src/lib/scraper';

async function investigateIGH() {
    console.log('🔍 Investigating Inver Grove Heights Hockey Association\n');

    const igh = associations.find(a => a.name === 'Inver Grove Heights Hockey Association');
    if (!igh) {
        console.log('❌ IGH not found');
        return;
    }

    const teams = await scrapeAssociation(igh);

    console.log(`\n✅ Found ${teams.length} teams after filtering:`);
    teams.forEach(team => {
        console.log(`- ${team.name} (${team.team_level})`);
        console.log(`  URL: ${team.calendar_sync_url}`);
    });
}

investigateIGH().catch(console.error);
