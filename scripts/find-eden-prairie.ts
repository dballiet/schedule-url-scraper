import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

async function findEdenPrairieSquirtB2Red() {
    console.log('🔎 Looking for Eden Prairie Squirt B2 Red...\n');

    const ep = ASSOCIATIONS.find(a => a.name.toLowerCase().includes('eden prairie'));
    if (!ep) {
        console.log('❌ Eden Prairie association not found');
        return;
    }

    console.log(`Association: ${ep.name}`);
    console.log(`URL: ${ep.baseUrl}\n`);

    const teams = await scrapeAssociation(ep);

    console.log(`\nFound ${teams.length} teams total.`);

    const targetTeam = teams.find(t =>
        t.name.toLowerCase().includes('squirt') &&
        t.name.toLowerCase().includes('b2') &&
        t.name.toLowerCase().includes('red')
    );

    if (targetTeam) {
        console.log('\n✅ FOUND EDEN PRAIRIE SQUIRT B2 RED!');
        console.log(`Team Name: ${targetTeam.name}`);
        console.log(`Calendar Link: ${targetTeam.calendar_sync_url}`);
        console.log(`Tags ID: ${targetTeam.calendar_sync_url?.match(/tags=(\d+)/)?.[1]}`);
    } else {
        console.log('\n❌ Eden Prairie Squirt B2 Red NOT found.');
        console.log('Teams found containing "Squirt":');
        teams.filter(t => t.name.toLowerCase().includes('squirt')).forEach(t => {
            console.log(`- ${t.name} (${t.level_detail}) -> ${t.calendar_sync_url}`);
        });
    }
}

findEdenPrairieSquirtB2Red().catch(console.error);
