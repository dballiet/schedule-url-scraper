import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

async function findRogersSquirtB2() {
    console.log('🔎 Looking for Rogers Squirt B2...\n');

    const rogers = ASSOCIATIONS.find(a => a.name.toLowerCase().includes('rogers'));
    if (!rogers) {
        console.log('❌ Rogers association not found');
        return;
    }

    console.log(`Association: ${rogers.name}`);
    console.log(`URL: ${rogers.baseUrl}\n`);

    const teams = await scrapeAssociation(rogers);

    console.log(`\nFound ${teams.length} teams total.`);

    const targetTeam = teams.find(t =>
        t.name.toLowerCase().includes('squirt') &&
        t.name.toLowerCase().includes('b2')
    );

    if (targetTeam) {
        console.log('\n✅ FOUND ROGERS SQUIRT B2!');
        console.log(`Team Name: ${targetTeam.name}`);
        console.log(`Calendar Link: ${targetTeam.calendar_sync_url}`);
    } else {
        console.log('\n❌ Rogers Squirt B2 NOT found.');
        console.log('Teams found containing "Squirt":');
        teams.filter(t => t.name.toLowerCase().includes('squirt')).forEach(t => {
            console.log(`- ${t.name} (${t.level_detail}) -> ${t.calendar_sync_url}`);
        });
    }
}

findRogersSquirtB2().catch(console.error);
