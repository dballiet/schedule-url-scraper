import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';
import { Association } from '../src/lib/types';
import * as fs from 'fs';

async function spotCheckAssociation(association: Association) {
    try {
        console.log(`Checking ${association.name}...`);
        const teams = await scrapeAssociation(association);

        if (teams.length > 0) {
            // Pick a random team or the first one
            const team = teams[0];
            return {
                status: 'OK',
                name: association.name,
                teamName: team.name,
                url: team.calendar_sync_url
            };
        } else {
            return {
                status: 'WARNING',
                name: association.name,
                error: 'No teams found'
            };
        }
    } catch (error: any) {
        return {
            status: 'ERROR',
            name: association.name,
            error: error.message || 'Unknown error'
        };
    }
}

async function runSpotCheck() {
    console.log(`🔎 Starting Spot Check for ${ASSOCIATIONS.length} Associations`);
    console.log('='.repeat(80));

    const results = [];
    const batchSize = 5;

    for (let i = 0; i < ASSOCIATIONS.length; i += batchSize) {
        const batch = ASSOCIATIONS.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(ASSOCIATIONS.length / batchSize)}...`);

        const batchResults = await Promise.all(batch.map(assoc => spotCheckAssociation(assoc)));
        results.push(...batchResults);
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 Spot Check Results');
    console.log('='.repeat(80));

    const passed = results.filter(r => r.status === 'OK');
    const failed = results.filter(r => r.status !== 'OK');

    // Write detailed report to file
    let reportContent = '# Association Spot Check Report\n\n';
    reportContent += `Date: ${new Date().toISOString()}\n\n`;

    reportContent += '## ✅ Working Associations\n\n';
    reportContent += '| Association | Sample Team | Validation Link |\n';
    reportContent += '|-------------|-------------|-----------------|\n';

    passed.forEach(r => {
        reportContent += `| ${r.name} | ${r.teamName} | ${r.url} |\n`;
        console.log(`✅ ${r.name}: ${r.teamName} -> ${r.url}`);
    });

    if (failed.length > 0) {
        reportContent += '\n## ❌ Issues Found\n\n';
        reportContent += '| Association | Error |\n';
        reportContent += '|-------------|-------|\n';

        console.log('\n❌ Issues Found:');
        failed.forEach(r => {
            reportContent += `| ${r.name} | ${r.error} |\n`;
            console.log(`   - ${r.name}: ${r.error}`);
        });
    }

    fs.writeFileSync('spot_check_report.md', reportContent);
    console.log('\n📝 Detailed report saved to spot_check_report.md');
}

runSpotCheck().catch(console.error);
