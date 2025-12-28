/**
 * Verification script to ensure single_event fix didn't break other associations
 * Tests a variety of platform types
 */
import { scrapeAssociation } from '../src/lib/scraper';
import { Association } from '../src/lib/types';

// Sample associations from different platform types
const TEST_ASSOCIATIONS: Association[] = [
    // PuckSystems sites (should benefit from single_event fix)
    { name: "Mahtomedi Youth Hockey Association", baseUrl: "https://mahtomedihockey.pucksystems.com" },
    { name: "Buffalo Hockey Association", baseUrl: "https://buffalo.pucksystems2.com" },

    // SportsEngine sites (most common)
    { name: "Eagan Hockey Association", baseUrl: "https://www.eaganhockey.com" },
    { name: "Eastview Hockey Association", baseUrl: "https://www.eastviewhockey.net" },

    // Other platform types
    { name: "Lakeville Hockey Association", baseUrl: "https://www.lakevillehockey.org" },
];

async function testAssociation(association: Association): Promise<{ teams: number; hasIssue: boolean; issues: string[] }> {
    console.log(`\nTesting ${association.name}...`);

    try {
        const teams = await scrapeAssociation(association, ['Bantams', 'Peewees']);

        const issues: string[] = [];

        // Check for single_event URLs (should be 0)
        const singleEventTeams = teams.filter(t =>
            t.calendar_sync_url.includes('single_event') ||
            t.calendar_sync_url.includes('event_id=')
        );
        if (singleEventTeams.length > 0) {
            issues.push(`${singleEventTeams.length} teams with single_event URLs`);
        }

        // Check for teams without proper calendar URLs
        const badUrlTeams = teams.filter(t =>
            !t.calendar_sync_url.includes('webcal://') &&
            !t.calendar_sync_url.includes('ical_feed') &&
            !t.calendar_sync_url.includes('.ics') &&
            !t.calendar_sync_url.includes('/calendar') &&
            !t.calendar_sync_url.includes('/schedule') &&
            !t.calendar_sync_url.includes('sportsengine.com')
        );
        if (badUrlTeams.length > 0) {
            issues.push(`${badUrlTeams.length} teams with questionable calendar URLs`);
        }

        console.log(`  Found ${teams.length} Bantam/Peewee teams`);
        if (issues.length > 0) {
            console.log(`  ⚠️ Issues: ${issues.join(', ')}`);
        } else {
            console.log(`  ✓ No issues detected`);
        }

        // Show sample URLs
        if (teams.length > 0) {
            console.log(`  Sample URL: ${teams[0].calendar_sync_url}`);
        }

        return { teams: teams.length, hasIssue: issues.length > 0, issues };
    } catch (error) {
        console.log(`  ❌ Error: ${error}`);
        return { teams: 0, hasIssue: true, issues: [`Error: ${error}`] };
    }
}

async function main() {
    console.log('=== Multi-Association Verification ===');
    console.log('Testing that single_event fix works universally...\n');

    const results: Array<{ name: string; teams: number; hasIssue: boolean; issues: string[] }> = [];

    for (const association of TEST_ASSOCIATIONS) {
        const result = await testAssociation(association);
        results.push({ name: association.name, ...result });
    }

    console.log('\n\n=== SUMMARY ===\n');
    console.log('Association                              | Teams | Status');
    console.log('-----------------------------------------|-------|--------');

    for (const r of results) {
        const status = r.hasIssue ? '❌ ISSUE' : '✓ OK';
        const name = r.name.padEnd(40);
        console.log(`${name} | ${String(r.teams).padStart(5)} | ${status}`);
    }

    const failCount = results.filter(r => r.hasIssue).length;
    if (failCount === 0) {
        console.log('\n✓ All associations passed verification!');
    } else {
        console.log(`\n❌ ${failCount} association(s) have issues`);
    }
}

main().catch(console.error);
