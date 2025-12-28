import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';
import { ScrapedTeam } from '../src/lib/types';
import * as fs from 'fs';

interface TestCase {
    association: string;
    teamName: string;
    expectedUrl: string;
    platform: 'SportsEngine' | 'Crossbar' | 'Other';
}

interface GroundTruthTeam {
    name: string;
    team_level: string;
    level_detail?: string;
    calendar_sync_url?: string;
}

interface GroundTruthEntry {
    association: string;
    season: string;
    teams: GroundTruthTeam[];
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
    },
    // Mankato (SportsEngine) - tests empty feed filter
    {
        association: 'Mankato Area Hockey Association',
        teamName: 'Peewee C White',
        expectedUrl: 'webcal://www.mankatohockey.com/ical_feed?tags=9178224',
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
        tests: [] as any[],
        groundTruth: {
            total: 0,
            passed: 0,
            failed: 0,
            entries: [] as any[]
        }
    };

    const associationCache = new Map<string, ScrapedTeam[]>();
    const getAssociation = (assocName: string) =>
        ASSOCIATIONS.find(a => a.name.toLowerCase().includes(assocName.toLowerCase()));

    const getTeamsForAssociation = async (assocName: string) => {
        const association = getAssociation(assocName);
        if (!association) return { association: null as any, teams: null as any };
        if (associationCache.has(association.name)) {
            return { association, teams: associationCache.get(association.name)! };
        }
        const teams = await scrapeAssociation(association);
        associationCache.set(association.name, teams);
        return { association, teams };
    };

    const groundTruthPath = 'scripts/ground-truth.json';
    let groundTruthData: GroundTruthEntry[] = [];
    if (fs.existsSync(groundTruthPath)) {
        try {
            groundTruthData = JSON.parse(fs.readFileSync(groundTruthPath, 'utf8')) as GroundTruthEntry[];
        } catch (error) {
            console.warn(`Unable to read ground truth file at ${groundTruthPath}:`, error);
        }
    }

    // Group tests by association
    const testsByAssociation = TEST_CASES.reduce((acc, test) => {
        if (!acc[test.association]) acc[test.association] = [];
        acc[test.association].push(test);
        return acc;
    }, {} as Record<string, TestCase[]>);

    for (const [assocName, tests] of Object.entries(testsByAssociation)) {
        console.log(`\n📋 Testing ${assocName} (${tests[0].platform})`);
        console.log('-'.repeat(80));

        const { association, teams } = await getTeamsForAssociation(assocName);
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

    // Ground truth verification (season-specific known values)
    if (groundTruthData.length > 0) {
        console.log('\n📌 Ground Truth Verification');
        console.log('-'.repeat(80));
    }

    const normalizeToken = (value: string | undefined) =>
        (value || '').toLowerCase().replace(/\s+/g, '');

    for (const entry of groundTruthData) {
        console.log(`\n🔍 ${entry.association} (${entry.season})`);
        const { association, teams } = await getTeamsForAssociation(entry.association);
        if (!association || !teams) {
            console.log(`   ❌ Association "${entry.association}" not found or failed to scrape`);
            results.groundTruth.failed += entry.teams.length;
            entry.teams.forEach(expected => {
                results.groundTruth.entries.push({
                    association: entry.association,
                    season: entry.season,
                    expected,
                    found: null,
                    status: 'FAILED',
                    reason: 'Association not found'
                });
            });
            continue;
        }

        for (const expected of entry.teams) {
            results.groundTruth.total++;
            const match = teams.find(t => {
                if (normalizeToken(t.team_level) !== normalizeToken(expected.team_level)) return false;
                if (normalizeToken(t.name) !== normalizeToken(expected.name)) return false;
                if (expected.level_detail && normalizeToken(t.level_detail) !== normalizeToken(expected.level_detail)) return false;
                if (expected.calendar_sync_url && t.calendar_sync_url !== expected.calendar_sync_url) return false;
                return true;
            });

            const passed = !!match;
            const symbol = passed ? '✅' : '❌';
            const detail = expected.level_detail ? ` ${expected.level_detail}` : '';

            console.log(`   ${symbol} ${expected.name} (${expected.team_level}${detail})`);
            if (!passed) {
                const fallback = teams.find(t =>
                    normalizeToken(t.team_level) === normalizeToken(expected.team_level) &&
                    normalizeToken(t.name) === normalizeToken(expected.name)
                );
                if (fallback) {
                    console.log(`      Found team, URL mismatch: ${fallback.calendar_sync_url}`);
                } else {
                    console.log('      Found: NOT FOUND');
                }
                results.groundTruth.failed++;
            } else {
                results.groundTruth.passed++;
            }

            results.groundTruth.entries.push({
                association: entry.association,
                season: entry.season,
                expected,
                found: match || null,
                status: passed ? 'PASSED' : 'FAILED'
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

    if (results.groundTruth.total > 0) {
        console.log('\n📌 Ground Truth Totals:');
        console.log(`   ✅ Passed: ${results.groundTruth.passed}`);
        console.log(`   ❌ Failed: ${results.groundTruth.failed}`);
    }

    // Write results
    fs.writeFileSync('test_results.json', JSON.stringify(results, null, 2));
    console.log('\n📝 Detailed results written to test_results.json\n');

    // Exit with error code if any tests failed
    if (results.summary.failed > 0 || results.groundTruth.failed > 0) {
        process.exit(1);
    }
}

runTests().catch(error => {
    console.error('Test suite failed with error:', error);
    process.exit(1);
});
