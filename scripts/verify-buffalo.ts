/**
 * Quick Buffalo verification
 */
import { scrapeAssociation } from '../src/lib/scraper';

const BUFFALO = { name: "Buffalo Hockey Association", baseUrl: "https://buffalo.pucksystems2.com" };

async function main() {
    console.log('=== Buffalo Hockey Association ===\n');

    const teams = await scrapeAssociation(BUFFALO);

    console.log(`\nTotal teams: ${teams.length}\n`);

    // Group by level
    const byLevel: Record<string, typeof teams> = {};
    teams.forEach(t => {
        if (!byLevel[t.team_level]) byLevel[t.team_level] = [];
        byLevel[t.team_level].push(t);
    });

    for (const [level, levelTeams] of Object.entries(byLevel)) {
        console.log(`${level}:`);
        for (const t of levelTeams) {
            console.log(`  ${t.level_detail} - ${t.name}: ${t.calendar_sync_url}`);
        }
    }

    const issues = teams.filter(t =>
        t.calendar_sync_url.includes('single_event') ||
        t.calendar_sync_url.includes('event_id')
    );
    console.log(`\nSingle event URL issues: ${issues.length}`);
}

main().catch(console.error);
