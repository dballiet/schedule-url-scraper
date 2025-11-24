'use client';

import { ScrapedTeam } from '@/lib/types';
import { formatTeamsToCsv } from '@/lib/csv';
import { Download } from 'lucide-react';

interface ResultsTableProps {
    teams: ScrapedTeam[];
}

export function ResultsTable({ teams }: ResultsTableProps) {
    const downloadCsv = () => {
        const csv = formatTeamsToCsv(teams);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hockey-schedules-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    if (teams.length === 0) return null;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Results ({teams.length} teams found)</h2>
                <button
                    onClick={downloadCsv}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
                >
                    <Download className="w-4 h-4" />
                    Download CSV
                </button>
            </div>

            <div className="border rounded-lg overflow-hidden overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Association</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detail</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Calendar URL</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {teams.map((team, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{team.association_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{team.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{team.team_level}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{team.level_detail}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 truncate max-w-xs">
                                    <a href={team.calendar_sync_url} target="_blank" rel="noopener noreferrer" title={team.calendar_sync_url}>
                                        {team.calendar_sync_url}
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
