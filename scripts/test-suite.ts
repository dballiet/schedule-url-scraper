import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';
import * as fs from 'fs';

interface TestCase {
    association: string;
    teamName: string;
    expectedUrl: string;
    platform: 'SportsEngine' | 'Crossbar' | 'Other';
}

const TEST_CASES: TestCase[] = [
    // Anoka (SportsEngine)
    {
        association: 'Anoka',
        teamName: 'Bantam A',
        expectedUrl: 'webcal://www.anokaareahockey.com/ical_feed?tags=9100345',
        platform: 'SportsEngine'
    },
    {
        association: 'Anoka',
        teamName: 'Squirt B1',
        expectedUrl: 'webcal://www.anokaareahockey.com/ical_feed?tags=9100398',
        platform: 'SportsEngine'
    },
    // Buffalo (SportsEngine)
    {
        association: 'Buffalo',
        teamName: 'Squirt B1',
        expectedUrl: 'webcal://buffalo.pucksystems2.com/ical_feed?tags=9147098',
        platform: 'SportsEngine'
    },
    {
        association: 'Buffalo',
        teamName: 'Bantam B2',
        expectedUrl: 'webcal://buffalo.pucksystems2.com/ical_feed?tags=9135406',
        platform: 'SportsEngine'
    },
    // Chaska Chanhassen (Crossbar)
    {
        association: 'Chaska',
        teamName: 'Squirt B1 Gold',
        expectedUrl: 'https://www.cchockey.org/team/142360/calendar',
        platform: 'Crossbar'
    },
    // Minnetonka (SportsEngine)
    {
        association: 'Minnetonka',
        teamName: 'Squirt B2 Blue',
        expectedUrl: 'webcal://www.tonkahockey.org/ical_feed?tags=9209292',
        platform: 'SportsEngine'
    },
    {
        association: 'Minnetonka',
        teamName: 'Bantam AA',
        expectedUrl: 'webcal://www.tonkahockey.org/ical_feed?tags=9136984',
        platform: 'SportsEngine'
    },
    // St Paul Capitals (Crossbar)
    {
        association: 'St. Paul Capitals',
        teamName: 'PeeWee A',
        expectedUrl: 'https://www.stpaulcapitalshockey.com/team/154117/calendar',
        platform: 'Crossbar'
    },
    // Blaine (SportsEngine)
    {
        association: 'Blaine Youth Hockey Association',
        teamName: 'Peewee B2',
        expectedUrl: 'webcal://www.byha.org/ical_feed?tags=9236045',
        platform: 'SportsEngine'
    },
    // Woodbury (SportsEngine)
    {
        association: 'Woodbury Area Hockey Club',
        teamName: 'Bantam B1 Royal',
        expectedUrl: 'webcal://www.woodburyhockey.com/ical_feed?tags=9248176',
        platform: 'SportsEngine'
    },
    // Waconia (Sprocket Sports / SPA)
    {
        association: 'Waconia Hockey Association',
        teamName: 'Squirt C',
        expectedUrl: 'webcal://waconiahockey.sprocketsports.com/ical?team=26272',
        platform: 'Other'
    },
    // Eden Prairie (SportsEngine)
    {
        association: 'Eden Prairie Hockey Association',
        teamName: 'Squirt B2 Red',
        expectedUrl: 'webcal://www.ephockey.com/ical_feed?tags=9256701',
        platform: 'SportsEngine'
    },
    // Rogers (Crossbar)
    {
        association: 'Rogers Youth Hockey Association',
        teamName: 'Squirt B2 Black',
        expectedUrl: 'https://www.rogershockey.com/team/162578/calendar',
        platform: 'Crossbar'
    },
    // Prior Lake (SportsEngine)
    {
        association: 'Prior Lake-Savage Hockey Association',
        teamName: 'Squirt B2 Gold',
        expectedUrl: 'webcal://www.plsha.com/ical_feed?tags=5220340',
        platform: 'SportsEngine'
    }
];

async function runTests() {
    console.log('🏒 Running Comprehensive Test Suite\n');
    console.log('='.repeat(80));

    const results: any = {
        summary: {
            total: TEST_CASES.length,
            passed: 0,
            failed: 0,
            byPlatform: {} as Record<string, { passed: number; failed: number }>
        },
        tests: [] as any[]
    };

    // Group tests by association
    const testsByAssociation = TEST_CASES.reduce((acc, test) => {
        if (!acc[test.association]) acc[test.association] = [];
        acc[test.association].push(test);
        return acc;
    }, {} as Record<string, TestCase[]>);

    for (const [assocName, tests] of Object.entries(testsByAssociation)) {
        console.log(`\n📋 Testing ${assocName} (${tests[0].platform})`);
        console.log('-'.repeat(80));

        const association = ASSOCIATIONS.find(a => a.name.toLowerCase().includes(assocName.toLowerCase()));

        if (!association) {
            console.log(`❌ Association "${assocName}" not found in ASSOCIATIONS list`);
            tests.forEach(test => {
                results.tests.push({
                    ...test,
                    status: 'FAILED',
                    reason: 'Association not found',
                    foundUrl: null
                });
                results.summary.failed++;
            });
            continue;
        }

        const teams = await scrapeAssociation(association);
        console.log(`   Found ${teams.length} teams total\n`);

        for (const test of tests) {
            // Find matching team (case-insensitive, stricter matching)
            const team = teams.find(t => {
                const nameLower = t.name.toLowerCase();
                const testNameLower = test.teamName.toLowerCase();

                // Exact match
                if (nameLower === testNameLower) return true;

                // Handle abbreviations in matching
                let normalizedTestName = testNameLower
                    .replace(/\bbantam\b/g, 'bn')
                    .replace(/\bpeewee\b/g, 'pw')
                    .replace(/\bsquirt\b/g, 'sq');

                let normalizedTeamName = nameLower
                    .replace(/\bbantam\b/g, 'bn')
                    .replace(/\bpeewee\b/g, 'pw')
                    .replace(/\bsquirt\b/g, 'sq');

                const regex = new RegExp(`\\b${normalizedTestName}\\b`);
                if (regex.test(normalizedTeamName)) return true;

                const reverseRegex = new RegExp(`\\b${normalizedTeamName}\\b`);
                if (reverseRegex.test(normalizedTestName)) return true;

                return false;
            });

            const passed = team && team.calendar_sync_url === test.expectedUrl;
            const symbol = passed ? '✅' : '❌';

            console.log(`   ${symbol} ${test.teamName}`);
            console.log(`      Expected: ${test.expectedUrl}`);
            console.log(`      Found:    ${team ? team.calendar_sync_url : 'NOT FOUND'}`);

            if (passed) {
                results.summary.passed++;
            } else {
                results.summary.failed++;
                if (team) {
                    console.log(`      Note: Found team "${team.name}" but URL mismatch`);
                }
            }
            console.log();

            // Track by platform
            if (!results.summary.byPlatform[test.platform]) {
                results.summary.byPlatform[test.platform] = { passed: 0, failed: 0 };
            }
            if (passed) {
                results.summary.byPlatform[test.platform].passed++;
            } else {
                results.summary.byPlatform[test.platform].failed++;
            }

            results.tests.push({
                ...test,
                status: passed ? 'PASSED' : 'FAILED',
                foundUrl: team?.calendar_sync_url || null,
                foundTeamName: team?.name || null
            });
        }
    }

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 Test Summary');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${results.summary.total}`);
    console.log(`✅ Passed: ${results.summary.passed}`);
    console.log(`❌ Failed: ${results.summary.failed}`);
    console.log(`Success Rate: ${((results.summary.passed / results.summary.total) * 100).toFixed(1)}%`);

    console.log('\n📈 Results by Platform:');
    for (const [platform, stats] of Object.entries(results.summary.byPlatform)) {
        const total = stats.passed + stats.failed;
        const rate = ((stats.passed / total) * 100).toFixed(1);
        console.log(`   ${platform}: ${stats.passed}/${total} (${rate}%)`);
    }

    // Write results
    fs.writeFileSync('test_results.json', JSON.stringify(results, null, 2));
    console.log('\n📝 Detailed results written to test_results.json\n');

    // Exit with error code if any tests failed
    if (results.summary.failed > 0) {
        process.exit(1);
    }
}

runTests().catch(error => {
    console.error('Test suite failed with error:', error);
    process.exit(1);
});
