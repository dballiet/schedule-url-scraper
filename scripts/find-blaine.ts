import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

async function findBlainePeeweeB2() {
    console.log('🔎 Looking for Blaine Peewee B2...\n');

    const blaine = ASSOCIATIONS.find(a => a.name.toLowerCase().includes('blaine'));
    if (!blaine) {
        console.log('❌ Blaine association not found');
        return;
    }

    console.log(`Association: ${blaine.name}`);
    console.log(`URL: ${blaine.baseUrl}\n`);

    const teams = await scrapeAssociation(blaine);

    console.log(`\nFound ${teams.length} teams total.`);

    // Look for Peewee B2
    // Note: Blaine might use "Peewee B2" or "Peewee B2 Blue/Gold" etc.
    // We'll look for any Peewee B2
    const peeweeB2Teams = teams.filter(t =>
        t.name.toLowerCase().includes('peewee') &&
        (t.level_detail.includes('B2') || t.name.toLowerCase().includes('b2'))
    );

    if (peeweeB2Teams.length > 0) {
        console.log(`\n✅ FOUND ${peeweeB2Teams.length} BLAINE PEEWEE B2 TEAM(S)!`);
        peeweeB2Teams.forEach(t => {
            console.log(`Team Name: ${t.name}`);
            console.log(`Calendar Link: ${t.calendar_sync_url}`);
            console.log('---');
        });
    } else {
        console.log('\n❌ Blaine Peewee B2 NOT found.');
        console.log('Teams found containing "Peewee":');
        teams.filter(t => t.name.toLowerCase().includes('peewee')).forEach(t => {
            console.log(`- ${t.name} (${t.level_detail}) -> ${t.calendar_sync_url}`);
        });
    }
}

findBlainePeeweeB2().catch(console.error);
