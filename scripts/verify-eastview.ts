/**
 * Quick verification script for Eastview co-op team fix
 * Scrapes Eastview and confirms all expected Bantam teams are present
 */
import { scrapeAssociation } from '../src/lib/scraper';

const EASTVIEW = { name: "Eastview Hockey Association", baseUrl: "https://www.eastviewhockey.net" };

const EXPECTED_BANTAM_TEAMS = [
    'Bantam A',
    'B1-Black', // or variations like "Bantam B1 - Black"
    'B1-White', // or "Bantam B1 - White"  
    'B2-Black', // or "Bantam B2 - Black"
    'B2-White', // or "Bantam B2 - White"
    'Bantam C'
];

async function main() {
    console.log('=== Eastview Co-op Team Verification ===\n');

    const teams = await scrapeAssociation(EASTVIEW, ['Bantams']);

    console.log(`\n=== Found ${teams.length} Bantam teams ===\n`);

    for (const team of teams) {
        console.log(`  ${team.name}`);
        console.log(`    Level: ${team.team_level} ${team.level_detail}`);
        console.log(`    Calendar: ${team.calendar_sync_url}`);
        console.log('');
    }

    // Check for expected teams
    console.log('\n=== Checking for expected teams ===\n');

    const foundTeamNames = teams.map(t => t.name.toLowerCase());

    const checks = [
        { label: 'Bantam A', pattern: /bantam.*a(?!\w)/i },
        { label: 'B1-Black', pattern: /b1.*black/i },
        { label: 'B1-White', pattern: /b1.*white/i },
        { label: 'B2-Black', pattern: /b2.*black/i },
        { label: 'B2-White', pattern: /b2.*white/i },
        { label: 'Bantam C', pattern: /bantam.*c(?!\w)/i }
    ];

    let allFound = true;
    for (const check of checks) {
        const found = teams.some(t => check.pattern.test(t.name));
        const status = found ? '✓' : '✗';
        console.log(`  ${status} ${check.label}: ${found ? 'FOUND' : 'MISSING'}`);
        if (!found) allFound = false;
    }

    console.log(`\n=== Result: ${allFound ? 'ALL EXPECTED TEAMS FOUND ✓' : 'SOME TEAMS MISSING ✗'} ===\n`);

    return allFound ? 0 : 1;
}

main().catch(console.error);
