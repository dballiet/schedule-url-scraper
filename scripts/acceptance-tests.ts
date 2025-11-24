import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

async function runAcceptanceTests() {
    console.log('🎯 Running Ground Truth Acceptance Tests\n');
    console.log('='.repeat(80));

    const tests = [
        {
            association: 'Anoka',
            teamName: 'Bantam A',
            expectedUrl: 'webcal://www.anokaareahockey.com/ical_feed?tags=9100345'
        },
        {
            association: 'Anoka',
            teamName: 'Squirt B1',
            expectedUrl: 'webcal://www.anokaareahockey.com/ical_feed?tags=9100398'
        },
        {
            association: 'Chaska',
            teamName: 'Squirt B1 Gold',
            expectedUrl: 'https://www.cchockey.org/team/142360/calendar'
        }
    ];

    let allPassed = true;

    for (const test of tests) {
        console.log(`\n📋 Testing: ${test.association} - ${test.teamName}`);
        console.log('-'.repeat(80));

        const association = ASSOCIATIONS.find(a => a.name.toLowerCase().includes(test.association.toLowerCase()));

        if (!association) {
            console.log(`❌ FAIL: Association "${test.association}" not found`);
            allPassed = false;
            continue;
        }

        const teams = await scrapeAssociation(association);
        const team = teams.find(t => {
            const nameLower = t.name.toLowerCase();
            const testNameLower = test.teamName.toLowerCase();
            return nameLower.includes(testNameLower) || testNameLower.includes(nameLower);
        });

        if (!team) {
            console.log(`❌ FAIL: Team "${test.teamName}" not found`);
            console.log(`   Found ${teams.length} teams total`);
            allPassed = false;
            continue;
        }

        const passed = team.calendar_sync_url === test.expectedUrl;
        const symbol = passed ? '✅' : '❌';

        console.log(`${symbol} ${passed ? 'PASS' : 'FAIL'}`);
        console.log(`   Team found: ${team.name}`);
        console.log(`   Expected:   ${test.expectedUrl}`);
        console.log(`   Found:      ${team.calendar_sync_url}`);

        if (!passed) {
            allPassed = false;
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log(allPassed ? '✅ ALL GROUND TRUTH TESTS PASSED' : '❌ SOME TESTS FAILED');
    console.log('='.repeat(80) + '\n');

    process.exit(allPassed ? 0 : 1);
}

runAcceptanceTests().catch(error => {
    console.error('Test failed with error:', error);
    process.exit(1);
});
