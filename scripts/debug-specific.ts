import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

async function debugSpecific() {
    console.log('🔍 Debugging Specific Associations');

    const targets = [
        'Mound Westonka Hockey Association',
        'Minneapolis Titans Hockey',
        'Hastings Hockey Association',
        'Inver Grove Heights Hockey Association'
    ];

    for (const name of targets) {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`Debugging: ${name}`);
        console.log('='.repeat(50));

        const assoc = ASSOCIATIONS.find(a => a.name === name);
        if (!assoc) {
            console.log('❌ Association not found in config');
            continue;
        }

        console.log(`URL: ${assoc.baseUrl}`);

        // For Mound Westonka, try the user-suggested URL if the default fails
        if (name === 'Mound Westonka Hockey Association') {
            // We'll stick to the default first to see if it works with new filters
            // If not, we might need to temporarily override it here or in the scraper
        }

        const teams = await scrapeAssociation(assoc);

        console.log(`\nFound ${teams.length} teams:`);
        teams.forEach(t => {
            console.log(`- ${t.name} (${t.team_level})`);
            console.log(`  Cal: ${t.calendar_sync_url}`);
        });

        if (teams.length === 0) {
            console.log('⚠️  No teams found!');
        }
    }
}

debugSpecific().catch(console.error);
