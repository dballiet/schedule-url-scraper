import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';
import { ScrapedTeam } from '../src/lib/types';

export interface ProgressUpdate {
    current: number;
    total: number;
    associationName: string;
    teamsFound: number;
    elapsedMs: number;
    estimatedRemainingMs: number;
}

/**
 * Scrape multiple associations in batch with progress callbacks
 * @param associationNames - Names of associations to scrape (or 'all' for all 63)
 * @param onProgress - Callback for progress updates
 * @param delayMs - Delay between associations (default 2000ms)
 */
export async function scrapeBatch(
    associationNames: string[] | 'all',
    onProgress?: (progress: ProgressUpdate) => void,
    delayMs: number = 2000
): Promise<ScrapedTeam[]> {
    const startTime = Date.now();
    const allTeams: ScrapedTeam[] = [];

    // Get associations to scrape
    const toScrape = associationNames === 'all'
        ? ASSOCIATIONS
        : ASSOCIATIONS.filter(a =>
            associationNames.some(name =>
                a.name.toLowerCase().includes(name.toLowerCase())
            )
        );

    const total = toScrape.length;
    console.log(`Starting batch scrape of ${total} associations...`);

    for (let i = 0; i < toScrape.length; i++) {
        const association = toScrape[i];
        const current = i + 1;

        try {
            console.log(`\n[${current}/${total}] Scraping ${association.name}...`);

            const teams = await scrapeAssociation(association);
            allTeams.push(...teams);

            const elapsedMs = Date.now() - startTime;
            const avgTimePerAssoc = elapsedMs / current;
            const remaining = total - current;
            const estimatedRemainingMs = avgTimePerAssoc * remaining;

            // Call progress callback
            if (onProgress) {
                onProgress({
                    current,
                    total,
                    associationName: association.name,
                    teamsFound: allTeams.length,
                    elapsedMs,
                    estimatedRemainingMs
                });
            }

            console.log(`  Found ${teams.length} teams`);
            console.log(`  Total teams so far: ${allTeams.length}`);
            console.log(`  Elapsed: ${Math.floor(elapsedMs / 1000)}s | Est. remaining: ${Math.floor(estimatedRemainingMs / 1000)}s`);

            // Delay before next association (except for last one)
            if (current < total) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        } catch (error) {
            console.error(`Error scraping ${association.name}:`, error);
            // Continue with next association despite errors
        }
    }

    const totalElapsed = Date.now() - startTime;
    console.log(`\n✅ Batch scrape complete!`);
    console.log(`   Total teams: ${allTeams.length}`);
    console.log(`   Total time: ${Math.floor(totalElapsed / 60000)}m ${Math.floor((totalElapsed % 60000) / 1000)}s`);

    return allTeams;
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const associationsToScrape = args.length > 0 ? args : 'all';

    scrapeBatch(
        associationsToScrape,
        (progress) => {
            // Simple CLI progress indicator
            process.stdout.write(`\r[${progress.current}/${progress.total}] ${progress.associationName} - ${progress.teamsFound} teams | ${Math.floor(progress.elapsedMs / 1000)}s elapsed`);
        }
    ).then(teams => {
        console.log(`\n\nFound ${teams.length} total teams`);
    }).catch(console.error);
}
