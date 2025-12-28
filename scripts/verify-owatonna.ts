/**
 * Quick Owatonna verification
 */
import { scrapeAssociation } from '../src/lib/scraper';

const OWATONNA = { name: "Owatonna Youth Hockey Association", baseUrl: "https://www.owatonnahockey.com" };

async function main() {
    console.log('=== Owatonna Youth Hockey Association ===\n');

    const teams = await scrapeAssociation(OWATONNA);

    console.log(`\nTotal teams: ${teams.length}\n`);

    // Check for /schedule URLs without team context (the issue)
    const badScheduleUrls = teams.filter(t =>
        t.calendar_sync_url.endsWith('/schedule') &&
        !t.calendar_sync_url.includes('/team/')
    );

    // Group by level
    const byLevel: Record<string, typeof teams> = {};
    teams.forEach(t => {
        if (!byLevel[t.team_level]) byLevel[t.team_level] = [];
        byLevel[t.team_level].push(t);
    });

    for (const [level, levelTeams] of Object.entries(byLevel)) {
        console.log(`${level}:`);
        for (const t of levelTeams) {
            const isBad = t.calendar_sync_url.endsWith('/schedule') && !t.calendar_sync_url.includes('/team/');
            const prefix = isBad ? '⚠️ BAD: ' : '  ✓ ';
            console.log(`${prefix}${t.level_detail} - ${t.name}: ${t.calendar_sync_url}`);
        }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total teams: ${teams.length}`);
    console.log(`Bad /schedule URLs (should be 0): ${badScheduleUrls.length}`);

    if (badScheduleUrls.length > 0) {
        console.log('\nProblematic entries:');
        badScheduleUrls.forEach(t => console.log(`  - ${t.name}: ${t.calendar_sync_url}`));
    }
}

main().catch(console.error);
