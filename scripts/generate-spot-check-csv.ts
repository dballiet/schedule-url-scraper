import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';
import * as fs from 'fs';
import * as path from 'path';

async function generateSpotCheckCsv() {
    console.log('📊 Generating Full Spot Check CSV (1 team per association)...');

    const results: string[] = ['Association,Team Name,Level,URL'];
    const failed: string[] = [];

    // Process sequentially to be safe
    for (let i = 0; i < ASSOCIATIONS.length; i++) {
        const assoc = ASSOCIATIONS[i];
        console.log(`\n[${i + 1}/${ASSOCIATIONS.length}] Processing ${assoc.name}...`);

        try {
            const teams = await scrapeAssociation(assoc);

            if (teams.length > 0) {
                // Try to find a Bantam or Peewee team first as they are good indicators
                let sample = teams.find(t => t.team_level === 'Bantams');
                if (!sample) sample = teams.find(t => t.team_level === 'Peewees');
                if (!sample) sample = teams[0];

                // Escape commas in names
                const safeName = sample.name.includes(',') ? `"${sample.name}"` : sample.name;
                const safeAssoc = assoc.name.includes(',') ? `"${assoc.name}"` : assoc.name;

                results.push(`${safeAssoc},${safeName},${sample.team_level},${sample.calendar_sync_url}`);
                console.log(`  ✅ Found: ${sample.name} (${sample.calendar_sync_url})`);
            } else {
                console.log('  ❌ No teams found');
                results.push(`${assoc.name},NO TEAMS FOUND,,`);
                failed.push(assoc.name);
            }

            // Small delay
            await new Promise(r => setTimeout(r, 1000));

        } catch (error) {
            console.error(`  ❌ Error processing ${assoc.name}:`, error);
            results.push(`${assoc.name},ERROR,,`);
            failed.push(assoc.name);
        }
    }

    const outputPath = path.join(process.cwd(), 'spot_check_all.csv');
    fs.writeFileSync(outputPath, results.join('\n'));

    console.log(`\n✅ CSV generated at: ${outputPath}`);
    console.log(`Total Associations: ${ASSOCIATIONS.length}`);
    console.log(`Failed/Empty: ${failed.length}`);
    if (failed.length > 0) {
        console.log('Failed Associations:');
        failed.forEach(f => console.log(`- ${f}`));
    }
}

generateSpotCheckCsv().catch(console.error);
