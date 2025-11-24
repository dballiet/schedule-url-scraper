import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

async function debugAssociations() {
    const problematic = [
        'Hastings Hockey Association',
        'Hutchinson Youth Hockey Association',
        'Inver Grove Heights Hockey Association'
    ];

    for (const name of problematic) {
        const assoc = ASSOCIATIONS.find(a => a.name === name);
        if (!assoc) {
            console.log(`❌ ${name} not found`);
            continue;
        }

        console.log(`\n${'='.repeat(80)}`);
        console.log(`Debugging: ${name}`);
        console.log(`URL: ${assoc.baseUrl}`);
        console.log('='.repeat(80));

        const teams = await scrapeAssociation(assoc);

        console.log(`\nFound ${teams.length} teams total:`);
        teams.forEach((team, idx) => {
            console.log(`\n${idx + 1}. ${team.name}`);
            console.log(`   Level: ${team.team_level} ${team.level_detail}`);
            console.log(`   URL: ${team.calendar_sync_url}`);
        });

        // Show Mite teams specifically
        const mites = teams.filter(t => t.team_level === 'Mites');
        console.log(`\n📋 Mite teams found: ${mites.length}`);
        mites.forEach(m => console.log(`   - ${m.name}`));

        // Show Bantam teams specifically  
        const bantams = teams.filter(t => t.team_level === 'Bantams');
        console.log(`\n📋 Bantam teams found: ${bantams.length}`);
        bantams.forEach(b => console.log(`   - ${b.name}`));
    }
}

debugAssociations().catch(console.error);
