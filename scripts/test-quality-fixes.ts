import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

async function runTests() {
    console.log('🧪 Testing Quality Improvements on Problematic Associations\n');

    const tests = [
        {
            name: 'Hastings Hockey Association',
            expectedKeywords: ['Group'],  // Should find"Mite 2 Group X" teams
            rejectKeywords: ['roster', 'pdf', 'layout'],
            minTeams: 5
        },
        {
            name: 'Hutchinson Youth Hockey Association',
            expectedKeywords: ['Mites1', 'Mites2', 'Mites3', 'Mites4'],
            rejectKeywords: ['click me', 'register', 'jamboree', 'madness'],
            minTeams: 5
        },
        {
            name: 'Inver Grove Heights Hockey Association',
            expectedTeams: ['Bantam C'],
            rejectKeywords: ['Bantam B2', 'Bantam B1'],
            maxBantams: 1 // Only Bantam C should exist
        }
    ];

    for (const test of tests) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`Testing: ${test.name}`);
        console.log('='.repeat(80));

        const assoc = ASSOCIATIONS.find(a => a.name === test.name);
        if (!assoc) {
            console.log(`❌ Association not found`);
            continue;
        }

        const teams = await scrapeAssociation(assoc);

        console.log(`\n✓ Found ${teams.length} teams total`);

        // Show all Mites
        const mites = teams.filter(t => t.team_level === 'Mites');
        console.log(`\n📋 Mite teams (${mites.length}):`);
        mites.forEach(m => console.log(`   - ${m.name}`));

        // Show all Bantams
        const bantams = teams.filter(t => t.team_level === 'Bantams');
        console.log(`\n📋 Bantam teams (${bantams.length}):`);
        bantams.forEach(b => console.log(`   - ${b.name}`));

        // Check for rejected keywords
        if (test.rejectKeywords) {
            const bad = teams.filter(t =>
                test.rejectKeywords!.some(kw => t.name.toLowerCase().includes(kw.toLowerCase()))
            );
            if (bad.length > 0) {
                console.log(`\n❌ Found ${bad.length} teams with rejected keywords:`);
                bad.forEach(t => console.log(`   - ${t.name}`));
            } else {
                console.log(`\n✅ No rejected keywords found`);
            }
        }

        // Check minimum teams
        if (test.minTeams) {
            const ageGroup = test.name.includes('Hutch') ? 'Mites' : 'all';
            const relevant = ageGroup === 'Mites' ? mites : teams;
            if (relevant.length >= test.minTeams) {
                console.log(`✅ Minimum teams met (${relevant.length} >= ${test.minTeams})`);
            } else {
                console.log(`⚠️  Below minimum (${relevant.length} < ${test.minTeams})`);
            }
        }

        // Check maximum bantams
        if (test.maxBantams !== undefined) {
            if (bantams.length <= test.maxBantams) {
                console.log(`✅ Bantam count correct (${bantams.length} <= ${test.maxBantams})`);
            } else {
                console.log(`❌ Too many Bantams (${bantams.length} > ${test.maxBantams})`);
            }
        }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('Testing complete!');
}

runTests().catch(console.error);
