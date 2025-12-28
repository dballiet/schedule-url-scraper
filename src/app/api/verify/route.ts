import { NextRequest, NextResponse } from 'next/server';
import { verifyIcalUrl, sampleForVerification } from '@/lib/ical-utils';
import Papa from 'papaparse';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for verification

interface CsvRow {
    association: string;
    team_name: string;
    age_group: string;
    level_detail: string;
    calendar_url: string;
}

export async function POST(req: NextRequest) {
    const { csvContent } = await req.json();

    if (!csvContent || typeof csvContent !== 'string') {
        return NextResponse.json({ error: 'No CSV content provided' }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: any) => {
                controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
            };

            try {
                // Parse CSV
                const parsed = Papa.parse<CsvRow>(csvContent, {
                    header: true,
                    skipEmptyLines: true,
                    transformHeader: (header) => header.toLowerCase().trim().replace(/\s+/g, '_'),
                });

                if (parsed.errors.length > 0) {
                    send({ type: 'error', message: `CSV parsing errors: ${parsed.errors.map(e => e.message).join(', ')}` });
                    controller.close();
                    return;
                }

                // Filter to rows with valid calendar URLs
                const validRows = parsed.data.filter(row =>
                    row.calendar_url &&
                    row.calendar_url.trim() !== '' &&
                    row.association
                );

                if (validRows.length === 0) {
                    send({ type: 'error', message: 'No valid entries with calendar URLs found in CSV' });
                    controller.close();
                    return;
                }

                // Sample entries (5% with at least 1 per association)
                const sampled = sampleForVerification(validRows, 0.05, 50);

                send({
                    type: 'start',
                    totalEntries: validRows.length,
                    totalSamples: sampled.length,
                    associationCount: new Set(validRows.map(r => r.association)).size
                });

                const results: {
                    association: string;
                    team: string;
                    ageGroup: string;
                    levelDetail: string;
                    url: string;
                    status: 'valid' | 'empty' | 'error';
                    futureEvents: number;
                    totalEvents: number;
                    error?: string;
                }[] = [];

                let valid = 0;
                let empty = 0;
                let errors = 0;

                for (let i = 0; i < sampled.length; i++) {
                    const row = sampled[i];
                    const current = i + 1;

                    send({
                        type: 'progress',
                        current,
                        total: sampled.length,
                        association: row.association,
                        team: row.team_name,
                        url: row.calendar_url
                    });

                    const result = await verifyIcalUrl(row.calendar_url);

                    const entry = {
                        association: row.association,
                        team: row.team_name,
                        ageGroup: row.age_group,
                        levelDetail: row.level_detail,
                        url: row.calendar_url,
                        status: result.status,
                        futureEvents: result.futureEvents,
                        totalEvents: result.totalEvents,
                        error: result.error
                    };

                    results.push(entry);

                    if (result.status === 'valid') valid++;
                    else if (result.status === 'empty') empty++;
                    else errors++;

                    send({
                        type: 'result',
                        ...entry
                    });

                    // Small delay between requests to be polite
                    if (current < sampled.length) {
                        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
                    }
                }

                send({
                    type: 'complete',
                    summary: { valid, empty, errors, total: sampled.length }
                });

            } catch (error: any) {
                console.error('Verification stream error:', error);
                send({ type: 'error', message: error.message || 'Internal server error' });
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
