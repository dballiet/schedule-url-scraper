import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

async function findShakopeeSquirtA() {
    console.log('🔎 Looking for Shakopee Squirt A...\n');

    const shakopee = ASSOCIATIONS.find(a => a.name.toLowerCase().includes('shakopee'));
    if (!shakopee) {
        console.log('❌ Shakopee association not found');
        return;
    }

    console.log(`Association: ${shakopee.name}`);
    console.log(`URL: ${shakopee.baseUrl}\n`);

    const teams = await scrapeAssociation(shakopee);

    console.log(`\nFound ${teams.length} teams total.`);

    const squirtA = teams.find(t =>
        t.name.toLowerCase().includes('squirt') &&
        (t.level_detail === 'A' || t.name.toLowerCase().endsWith('squirt a') || t.name.toLowerCase().includes('squirt a '))
    );

    if (squirtA) {
        console.log('\n✅ FOUND SHAKOPEE SQUIRT A!');
        console.log(`Team Name: ${squirtA.name}`);
        console.log(`Calendar Link: ${squirtA.calendar_sync_url}`);
    } else {
        console.log('\n❌ Shakopee Squirt A NOT found.');
        console.log('Teams found containing "Squirt":');
        teams.filter(t => t.name.toLowerCase().includes('squirt')).forEach(t => {
            console.log(`- ${t.name} (${t.level_detail}) -> ${t.calendar_sync_url}`);
        });
    }
}

findShakopeeSquirtA().catch(console.error);
