import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

async function verifyFixes() {
    console.log('🛠️ Verifying Fixes for Rochester and North Branch\n');

    const targets = ['Rochester', 'North Branch'];

    for (const target of targets) {
        const assoc = ASSOCIATIONS.find(a => a.name.includes(target));
        if (!assoc) {
            console.log(`❌ ${target} not found in associations list!`);
            continue;
        }

        console.log(`Checking ${assoc.name} (${assoc.baseUrl})...`);
        try {
            const teams = await scrapeAssociation(assoc);
            if (teams.length > 0) {
                console.log(`✅ Success! Found ${teams.length} teams.`);
                console.log(`   Sample: ${teams[0].name} -> ${teams[0].calendar_sync_url}`);

                // Check specific teams mentioned by user if possible
                if (target === 'Rochester') {
                    const peewee = teams.find(t => t.name.toLowerCase().includes('peewee aa red'));
                    if (peewee) console.log(`   🎯 Found Peewee AA Red: ${peewee.calendar_sync_url}`);
                }
                if (target === 'North Branch') {
                    const squirt = teams.find(t => t.name.toLowerCase().includes('squirt b2'));
                    if (squirt) console.log(`   🎯 Found Squirt B2: ${squirt.calendar_sync_url}`);
                }
            } else {
                console.log(`❌ Failed: No teams found.`);
            }
        } catch (error) {
            console.log(`❌ Error: ${error}`);
        }
        console.log('-'.repeat(40));
    }
}

verifyFixes().catch(console.error);
