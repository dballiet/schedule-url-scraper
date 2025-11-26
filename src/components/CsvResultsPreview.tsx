'use client';

import { useMemo, useState } from 'react';
import { CsvTeamRecord, importFromCsv } from '@/lib/csv-utils';
import { cn } from '@/lib/utils';
import { Check, Copy } from 'lucide-react';

interface CsvResultsPreviewProps {
    csvText: string;
}

const STATUS_STYLES: Record<string, string> = {
    new: 'bg-green-50 text-green-700 border-green-200',
    url_changed: 'bg-orange-50 text-orange-700 border-orange-200',
    missing: 'bg-red-50 text-red-700 border-red-200',
    unchanged: 'bg-gray-100 text-gray-700 border-gray-200'
};

function formatRecordsForCopy(records: CsvTeamRecord[], includeStatus: boolean) {
    const headers = ['Association', 'Team Name', 'Age Group', 'Level Detail', 'Calendar URL'];
    if (includeStatus) {
        headers.push('Status', 'Notes');
    }

    const rows = records.map(record => {
        const base = [
            record.association,
            record.team_name,
            record.age_group,
            record.level_detail,
            record.calendar_url
        ];

        if (includeStatus) {
            base.push(record.status ?? '', record.notes ?? '');
        }

        return base.join('\t');
    });

    return [headers.join('\t'), ...rows].join('\n');
}

export function CsvResultsPreview({ csvText }: CsvResultsPreviewProps) {
    const [copied, setCopied] = useState(false);

    const records = useMemo(() => {
        if (!csvText) return [];
        return importFromCsv(csvText).filter(record =>
            record.association || record.team_name || record.calendar_url
        );
    }, [csvText]);

    const hasStatus = useMemo(() => records.some(record => !!record.status), [records]);

    if (records.length === 0) return null;

    const handleCopy = async () => {
        try {
            const text = formatRecordsForCopy(records, hasStatus);
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy results', error);
        }
    };

    return (
        <div className="bg-white shadow-sm rounded-lg p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-gray-900">Inline Results</h3>
                    <p className="text-sm text-gray-600">
                        Review and copy the scraped teams without downloading the CSV.
                    </p>
                    <p className="text-xs text-gray-500">
                        Showing {records.length} teams{hasStatus ? ' with status flags' : ''}.
                    </p>
                </div>
                <button
                    onClick={handleCopy}
                    className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg font-medium border transition-colors',
                        copied
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                    )}
                >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy table'}
                </button>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[520px] overflow-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">Association</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">Team</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">Age Group</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">Detail</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">Calendar URL</th>
                                {hasStatus && (
                                    <>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Notes</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {records.map((record, index) => (
                                <tr key={`${record.association}-${record.team_name}-${index}`} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">
                                        {record.association}
                                    </td>
                                    <td className="px-4 py-3 text-gray-900">{record.team_name}</td>
                                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{record.age_group}</td>
                                    <td className="px-4 py-3 text-gray-600">{record.level_detail}</td>
                                    <td className="px-4 py-3 text-blue-700 underline truncate max-w-[240px]">
                                        <a
                                            href={record.calendar_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={record.calendar_url}
                                        >
                                            {record.calendar_url}
                                        </a>
                                    </td>
                                    {hasStatus && (
                                        <>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={cn(
                                                        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border',
                                                        record.status
                                                            ? STATUS_STYLES[record.status] ?? STATUS_STYLES.unchanged
                                                            : 'bg-gray-100 text-gray-700 border-gray-200'
                                                    )}
                                                >
                                                    {record.status ?? 'n/a'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">{record.notes}</td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
