import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';
import { Association } from '../src/lib/types';

async function checkAssociation(association: Association) {
    const start = Date.now();
    try {
        console.log(`Checking ${association.name}...`);
        const teams = await scrapeAssociation(association);
        const duration = ((Date.now() - start) / 1000).toFixed(1);

        if (teams.length > 0) {
            return {
                status: 'OK',
                name: association.name,
                teams: teams.length,
                duration: `${duration}s`,
                error: null
            };
        } else {
            return {
                status: 'WARNING',
                name: association.name,
                teams: 0,
                duration: `${duration}s`,
                error: 'No teams found'
            };
        }
    } catch (error: any) {
        const duration = ((Date.now() - start) / 1000).toFixed(1);
        return {
            status: 'ERROR',
            name: association.name,
            teams: 0,
            duration: `${duration}s`,
            error: error.message || 'Unknown error'
        };
    }
}

async function runHealthCheck() {
    console.log(`🏥 Starting Health Check for ${ASSOCIATIONS.length} Associations`);
    console.log('='.repeat(80));

    const results = [];
    const batchSize = 5;

    for (let i = 0; i < ASSOCIATIONS.length; i += batchSize) {
        const batch = ASSOCIATIONS.slice(i, i + batchSize);
        console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(ASSOCIATIONS.length / batchSize)}...`);

        const batchResults = await Promise.all(batch.map(assoc => checkAssociation(assoc)));
        results.push(...batchResults);
    }

    const passed = results.filter(r => r.status === 'OK');
    const warnings = results.filter(r => r.status === 'WARNING');
    const errors = results.filter(r => r.status === 'ERROR');

    // Write results to file
    const fs = await import('fs');
    fs.writeFileSync('health_check_results.json', JSON.stringify({
        summary: {
            total: results.length,
            passed: passed.length,
            warnings: warnings.length,
            errors: errors.length
        },
        results: results
    }, null, 2));
    console.log('\n📝 Results saved to health_check_results.json');

    console.log('\n' + '='.repeat(80));
    console.log('📊 Health Check Summary');
    console.log('='.repeat(80));

    console.log(`Total: ${results.length}`);
    console.log(`✅ OK: ${passed.length}`);
    console.log(`⚠️ Warnings (0 teams): ${warnings.length}`);
    console.log(`❌ Errors: ${errors.length}`);

    if (warnings.length > 0) {
        console.log('\n⚠️ Associations with 0 teams:');
        warnings.forEach(r => console.log(`   - ${r.name} (${r.duration})`));
    }

    if (errors.length > 0) {
        console.log('\n❌ Failed Associations:');
        errors.forEach(r => console.log(`   - ${r.name}: ${r.error} (${r.duration})`));
    }

    console.log('\n✅ Working Associations:');
    passed.forEach(r => console.log(`   - ${r.name}: ${r.teams} teams (${r.duration})`));
}

runHealthCheck().catch(console.error);
