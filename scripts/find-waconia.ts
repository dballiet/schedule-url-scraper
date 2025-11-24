import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

async function main() {
    const waconia = ASSOCIATIONS.find(a => a.name.toLowerCase().includes('waconia'));

    if (!waconia) {
        console.error('Waconia association not found!');
        process.exit(1);
    }

    console.log(`\n🔎 Looking for Waconia Squirt C...`);
    console.log(`\nAssociation: ${waconia.name}`);
    console.log(`URL: ${waconia.baseUrl}\n`);

    try {
        const teams = await scrapeAssociation(waconia);

        const targetTeams = teams.filter(t => {
            const name = t.name.toLowerCase();
            return name.includes('squirt') &&
                name.includes('c');
        });

        if (targetTeams.length > 0) {
            console.log(`\n✅ FOUND ${targetTeams.length} WACONIA SQUIRT C TEAM(S)!`);
            targetTeams.forEach(t => {
                console.log(`Team Name: ${t.name}`);
                console.log(`Calendar Link: ${t.calendar_sync_url}`);

                if (t.calendar_sync_url.includes('26272')) {
                    console.log('🎯 MATCHES USER EXPECTED ID (26272)!');
                } else {
                    console.log('⚠️ DOES NOT MATCH USER EXPECTED ID (26272)');
                }
                console.log('---');
            });
        } else {
            console.log('\n❌ Waconia Squirt C NOT found.');
            console.log('Teams found containing "Squirt":');
            teams.filter(t => t.name.toLowerCase().includes('squirt')).forEach(t => {
                console.log(`- ${t.name} (${t.calendar_sync_url})`);
            });
        }

    } catch (error) {
        console.error('Error scraping Waconia:', error);
    }
}

main();
