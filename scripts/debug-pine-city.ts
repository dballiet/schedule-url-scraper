/**
 * Debug script for Pine City Youth Hockey Association
 */
import { scrapeAssociation } from '../src/lib/scraper';

const PINE_CITY = { name: "Pine City Youth Hockey Association", baseUrl: "https://pinecityyouthhockey.pucksystems.com" };

async function main() {
    console.log('=== Pine City Debug ===\n');

    const teams = await scrapeAssociation(PINE_CITY);

    console.log(`\n=== Found ${teams.length} teams ===\n`);

    for (const team of teams) {
        const hasIssue = team.calendar_sync_url.includes('single_event') || team.calendar_sync_url.includes('event_id');
        const prefix = hasIssue ? '⚠️ ' : '✓ ';
        console.log(`${prefix}${team.name}`);
        console.log(`    Level: ${team.team_level} ${team.level_detail}`);
        console.log(`    Calendar: ${team.calendar_sync_url}`);
        if (hasIssue) {
            console.log(`    ^^^ ISSUE: single_event URL should be team calendar`);
        }
        console.log('');
    }

    const issueCount = teams.filter(t => t.calendar_sync_url.includes('single_event') || t.calendar_sync_url.includes('event_id')).length;
    console.log(`\n=== Summary: ${issueCount} teams with single_event URLs (should be 0) ===\n`);
}

main().catch(console.error);
