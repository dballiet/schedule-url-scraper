import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

async function main() {
    const woodbury = ASSOCIATIONS.find(a => a.name.toLowerCase().includes('woodbury'));

    if (!woodbury) {
        console.error('Woodbury association not found!');
        process.exit(1);
    }

    console.log(`\n🔎 Looking for Woodbury Bantam B1 Royal...`);
    console.log(`\nAssociation: ${woodbury.name}`);
    console.log(`URL: ${woodbury.baseUrl}\n`);

    try {
        const teams = await scrapeAssociation(woodbury);

        const targetTeams = teams.filter(t => {
            const name = t.name.toLowerCase();
            return name.includes('bantam') &&
                name.includes('b1') &&
                name.includes('royal');
        });

        if (targetTeams.length > 0) {
            console.log(`\n✅ FOUND ${targetTeams.length} WOODBURY BANTAM B1 ROYAL TEAM(S)!`);
            targetTeams.forEach(t => {
                console.log(`Team Name: ${t.name}`);
                console.log(`Calendar Link: ${t.calendar_sync_url}`);

                if (t.calendar_sync_url.includes('9248176')) {
                    console.log('🎯 MATCHES USER EXPECTED ID (9248176)!');
                } else {
                    console.log('⚠️ DOES NOT MATCH USER EXPECTED ID (9248176)');
                }
                console.log('---');
            });
        } else {
            console.log('\n❌ Woodbury Bantam B1 Royal NOT found.');
            console.log('Teams found containing "Bantam":');
            teams.filter(t => t.name.toLowerCase().includes('bantam')).forEach(t => {
                console.log(`- ${t.name} (${t.calendar_sync_url})`);
            });
        }

    } catch (error) {
        console.error('Error scraping Woodbury:', error);
    }
}

main();
