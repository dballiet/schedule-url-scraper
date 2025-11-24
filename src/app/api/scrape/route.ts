import { NextRequest, NextResponse } from 'next/server';
import { scrapeAssociation } from '@/lib/scraper';
import { ASSOCIATIONS } from '@/lib/associations';
import { ScrapedTeam } from '@/lib/types';
import { exportToCsv, importFromCsv, mergeTeams } from '@/lib/csv-utils';
import Papa from 'papaparse';

export const runtime = 'nodejs';
export const maxDuration = 3600; // 60 minutes for batch scraping

export async function POST(req: NextRequest) {
    const { associations, masterCsv } = await req.json();

    if (!associations || (!Array.isArray(associations) && associations !== 'all')) {
        return NextResponse.json({ error: 'Invalid associations list' }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: any) => {
                controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
            };

            try {
                const allTeams: ScrapedTeam[] = [];
                const startTime = Date.now();

                // Get associations to scrape
                const toScrape = associations === 'all'
                    ? ASSOCIATIONS
                    : associations.map((name: string) => ASSOCIATIONS.find(a => a.name === name)).filter(Boolean);

                const total = toScrape.length;
                send({ type: 'start', total });

                for (let i = 0; i < toScrape.length; i++) {
                    const association = toScrape[i];
                    const current = i + 1;

                    send({ type: 'status', message: `Scraping ${association.name}...` });

                    try {
                        const teams = await scrapeAssociation(association);
                        allTeams.push(...teams);

                        const elapsedMs = Date.now() - startTime;
                        const avgTimePerAssoc = elapsedMs / current;
                        const remaining = total - current;
                        const estimatedRemainingMs = avgTimePerAssoc * remaining;

                        send({
                            type: 'progress',
                            current,
                            total,
                            associationName: association.name,
                            teamsFound: allTeams.length,
                            elapsedMs,
                            estimatedRemainingMs
                        });

                        // Small delay between associations
                        if (current < total) {
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                    } catch (error) {
                        console.error(`Error scraping ${association.name}:`, error);
                        send({ type: 'error', message: `Failed to scrape ${association.name}` });
                    }
                }

                // Generate CSV
                let finalCsv: string;
                let stats: any = {};

                if (masterCsv) {
                    // Merge with master CSV
                    const masterRecords = importFromCsv(masterCsv);
                    const merged = mergeTeams(masterRecords, allTeams);
                    finalCsv = Papa.unparse(merged);

                    stats = {
                        totalTeams: merged.length,
                        newTeams: merged.filter(t => t.status === 'new').length,
                        changedTeams: merged.filter(t => t.status === 'url_changed').length,
                        missingTeams: merged.filter(t => t.status === 'missing').length,
                        unchangedTeams: merged.filter(t => t.status === 'unchanged').length
                    };
                } else {
                    // Fresh export
                    finalCsv = exportToCsv(allTeams);
                    stats = { totalTeams: allTeams.length };
                }

                send({ type: 'complete', ...stats });
                send({ type: 'csv', data: finalCsv });
                send({ type: 'done' });
            } catch (error) {
                console.error('Stream error:', error);
                send({ type: 'error', message: 'Internal server error' });
            } finally {
                controller.close();
            }
        },
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
