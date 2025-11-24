import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

async function findMinneapolisSquirtCBlack() {
    console.log('🔎 Looking for Minneapolis Squirt C Black...\n');

    const minneapolis = ASSOCIATIONS.find(a => a.name.toLowerCase().includes('minneapolis'));
    if (!minneapolis) {
        console.log('❌ Minneapolis association not found');
        return;
    }

    console.log(`Association: ${minneapolis.name}`);
    console.log(`URL: ${minneapolis.baseUrl}\n`);

    const teams = await scrapeAssociation(minneapolis);

    console.log(`\nFound ${teams.length} teams total.\n`);

    // Look for Squirt C Black
    const squirtCBlack = teams.filter(t =>
        t.name.toLowerCase().includes('squirt') &&
        t.name.toLowerCase().includes('c') &&
        t.name.toLowerCase().includes('black')
    );

    if (squirtCBlack.length > 0) {
        console.log(`✅ FOUND ${squirtCBlack.length} MINNEAPOLIS SQUIRT C BLACK TEAM(S)!`);
        squirtCBlack.forEach(t => {
            console.log(`Team Name: ${t.name}`);
            console.log(`Calendar Link: ${t.calendar_sync_url}`);

            // Check if it matches the expected ID ending
            if (t.calendar_sync_url.includes('26296')) {
                console.log('🎯 MATCHES USER EXPECTED ID (26296)!');
            }
            console.log('---');
        });
    } else {
        console.log('\n❌ Minneapolis Squirt C Black NOT found.');
        console.log('Teams found containing "Squirt C":');
        teams.filter(t =>
            t.name.toLowerCase().includes('squirt') &&
            t.name.toLowerCase().includes('c')
        ).forEach(t => {
            console.log(`- ${t.name} (${t.level_detail}) -> ${t.calendar_sync_url}`);
        });
    }
}

findMinneapolisSquirtCBlack().catch(console.error);
