import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

async function findPriorLakeSquirtB2Gold() {
    console.log('🔎 Looking for Prior Lake Squirt B2 Gold...\n');

    const pl = ASSOCIATIONS.find(a => a.name.toLowerCase().includes('prior lake'));
    if (!pl) {
        console.log('❌ Prior Lake association not found');
        return;
    }

    console.log(`Association: ${pl.name}`);
    console.log(`URL: ${pl.baseUrl}\n`);

    const teams = await scrapeAssociation(pl);

    console.log(`\nFound ${teams.length} teams total.`);

    const targetTeam = teams.find(t =>
        t.name.toLowerCase().includes('squirt') &&
        t.name.toLowerCase().includes('b2') &&
        t.name.toLowerCase().includes('gold')
    );

    if (targetTeam) {
        console.log('\n✅ FOUND PRIOR LAKE SQUIRT B2 GOLD!');
        console.log(`Team Name: ${targetTeam.name}`);
        console.log(`Calendar Link: ${targetTeam.calendar_sync_url}`);
        console.log(`Tags ID: ${targetTeam.calendar_sync_url?.match(/tags=(\d+)/)?.[1]}`);
    } else {
        console.log('\n❌ Prior Lake Squirt B2 Gold NOT found.');
        console.log('Teams found containing "Squirt":');
        teams.filter(t => t.name.toLowerCase().includes('squirt')).forEach(t => {
            console.log(`- ${t.name} (${t.level_detail}) -> ${t.calendar_sync_url}`);
        });
    }
}

findPriorLakeSquirtB2Gold().catch(console.error);
