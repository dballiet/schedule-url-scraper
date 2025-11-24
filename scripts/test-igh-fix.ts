import { associations } from '../src/lib/associations';
import { scrapeAssociation } from '../src/lib/scraper';

async function testIGH() {
    console.log('🔍 Testing IGH Season Filtering Fix\n');

    const igh = associations.find(a => a.name === 'Inver Grove Heights Hockey Association');
    if (!igh) {
        console.log('❌ IGH not found');
        return;
    }

    const teams = await scrapeAssociation(igh);

    console.log(`\n✅ Found ${teams.length} teams after filtering:`);
    teams.forEach(team => {
        console.log(`- ${team.name} (${team.team_level})`);
        console.log(`  URL: ${team.calendar_sync_url}`);
    });

    // Check if Bantam C is found
    const bantamC = teams.find(t => t.name.includes('Bantam C'));
    const bantamB2 = teams.find(t => t.name.includes('Bantam B2'));

    console.log('\n📊 Verification:');
    if (bantamC) {
        console.log('✅ Bantam C 2025-2026 found (CORRECT)');
    } else {
        console.log('❌ Bantam C 2025-2026 NOT found');
    }

    if (bantamB2) {
        console.log('❌ Bantam B2 (old season) found (WRONG - should be filtered out)');
    } else {
        console.log('✅ Bantam B2 (old season) correctly filtered out');
    }
}

testIGH().catch(console.error);
