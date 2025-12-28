'use client';

import { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, XCircle, Copy, Check, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerificationResult {
    association: string;
    team: string;
    ageGroup: string;
    levelDetail: string;
    url: string;
    status: 'valid' | 'empty' | 'error';
    futureEvents: number;
    totalEvents: number;
    error?: string;
}

interface ProgressData {
    current: number;
    total: number;
    association: string;
    team: string;
    url: string;
}

interface Summary {
    valid: number;
    empty: number;
    errors: number;
    total: number;
}

const STATUS_ICONS = {
    valid: CheckCircle,
    empty: AlertCircle,
    error: XCircle,
};

const STATUS_COLORS = {
    valid: 'text-green-600',
    empty: 'text-amber-500',
    error: 'text-red-600',
};

const STATUS_BG = {
    valid: 'bg-green-50 border-green-200',
    empty: 'bg-amber-50 border-amber-200',
    error: 'bg-red-50 border-red-200',
};

export function VerifyCsv() {
    const [csvContent, setCsvContent] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [rowCount, setRowCount] = useState<number>(0);
    const [isVerifying, setIsVerifying] = useState(false);
    const [progress, setProgress] = useState<ProgressData | null>(null);
    const [results, setResults] = useState<VerificationResult[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [showAllResults, setShowAllResults] = useState(false);
    const [copied, setCopied] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setCsvContent(content);
            // Count rows (excluding header)
            const lines = content.split('\n').filter(l => l.trim());
            setRowCount(Math.max(0, lines.length - 1));
            // Reset previous results
            setResults([]);
            setSummary(null);
        };
        reader.readAsText(file);
    };

    const startVerification = async () => {
        if (!csvContent) return;

        setIsVerifying(true);
        setResults([]);
        setSummary(null);
        setProgress(null);

        try {
            const response = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ csvContent }),
            });

            if (!response.ok) throw new Error('Failed to start verification');
            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);

                        if (data.type === 'progress') {
                            setProgress(data);
                        } else if (data.type === 'result') {
                            setResults(prev => [...prev, data]);
                        } else if (data.type === 'complete') {
                            setSummary(data.summary);
                        } else if (data.type === 'error') {
                            console.error('Verification error:', data.message);
                        }
                    } catch (e) {
                        console.error('Failed to parse line:', line, e);
                    }
                }
            }
        } catch (error) {
            console.error('Verification error:', error);
        } finally {
            setIsVerifying(false);
            setProgress(null);
        }
    };

    const generateDebugOutput = () => {
        const failures = results.filter(r => r.status !== 'valid');
        if (failures.length === 0) return '';

        return failures.map(r => {
            const lines = [
                `Association: ${r.association}`,
                `Team: ${r.team}`,
                `Age Group: ${r.ageGroup}`,
                `Level: ${r.levelDetail}`,
                `URL: ${r.url}`,
                `Status: ${r.status.toUpperCase()}${r.status === 'empty' ? ` (${r.totalEvents} total events, 0 future)` : ''}`,
            ];
            if (r.error) lines.push(`Error: ${r.error}`);
            return lines.join('\n');
        }).join('\n---\n');
    };

    const handleCopyDebug = async () => {
        const output = generateDebugOutput();
        if (!output) return;

        try {
            await navigator.clipboard.writeText(output);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    const failedResults = results.filter(r => r.status !== 'valid');
    const displayedResults = showAllResults ? results : failedResults;

    return (
        <div className="space-y-6">
            {/* Upload Section */}
            <div className="bg-white shadow-sm rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    Verify Extracted CSV
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                    Upload a previously extracted CSV to spot-check that calendar URLs have current/future events.
                    We'll sample ~5% of entries (at least 1 per association) and verify each URL.
                </p>

                <div className="flex items-center gap-4 flex-wrap">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 bg-white border-2 border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:border-green-500 hover:text-green-600 transition-all"
                    >
                        <Upload className="w-4 h-4" />
                        {fileName || 'Choose CSV File'}
                    </button>

                    {fileName && (
                        <>
                            <span className="text-sm text-gray-500">
                                {rowCount} entries
                            </span>
                            <button
                                onClick={() => {
                                    setCsvContent(null);
                                    setFileName('');
                                    setRowCount(0);
                                    setResults([]);
                                    setSummary(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="text-sm text-red-600 hover:underline"
                            >
                                Clear
                            </button>
                        </>
                    )}
                </div>

                {csvContent && (
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={startVerification}
                            disabled={isVerifying}
                            className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {isVerifying ? 'Verifying...' : 'Start Verification'}
                            {!isVerifying && <CheckCircle className="w-5 h-5" />}
                        </button>
                    </div>
                )}
            </div>

            {/* Progress */}
            {progress && (
                <div className="bg-white shadow-sm rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Verification Progress</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm text-gray-600">
                            <span>Checking {progress.current} of {progress.total}</span>
                            <span>{progress.association}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                                className="bg-green-600 h-3 rounded-full transition-all duration-300"
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            />
                        </div>
                        <div className="text-sm text-gray-500 truncate">
                            {progress.team}: <span className="text-blue-600">{progress.url}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary */}
            {summary && (
                <div className="bg-white shadow-sm rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Verification Summary</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-gray-600 mb-1">{summary.total}</div>
                            <div className="text-xs text-gray-500">Sampled</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-600 mb-1">{summary.valid}</div>
                            <div className="text-xs text-gray-500">Valid</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-amber-500 mb-1">{summary.empty}</div>
                            <div className="text-xs text-gray-500">Empty</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-red-600 mb-1">{summary.errors}</div>
                            <div className="text-xs text-gray-500">Errors</div>
                        </div>
                    </div>

                    {/* Pass rate */}
                    {summary.total > 0 && (
                        <div className="mt-4 text-center">
                            <span className={cn(
                                "text-lg font-semibold",
                                summary.valid / summary.total >= 0.9 ? "text-green-600" :
                                    summary.valid / summary.total >= 0.7 ? "text-amber-600" : "text-red-600"
                            )}>
                                {Math.round((summary.valid / summary.total) * 100)}% pass rate
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Results Table */}
            {results.length > 0 && (
                <div className="bg-white shadow-sm rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                {showAllResults ? 'All Results' : 'Failed Entries'}
                            </h3>
                            <p className="text-sm text-gray-500">
                                {showAllResults
                                    ? `Showing all ${results.length} checked entries`
                                    : `Showing ${failedResults.length} entries that need attention`
                                }
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowAllResults(!showAllResults)}
                                className="text-sm text-blue-600 hover:underline"
                            >
                                {showAllResults ? 'Show failures only' : 'Show all results'}
                            </button>
                            {failedResults.length > 0 && (
                                <button
                                    onClick={handleCopyDebug}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                                        copied
                                            ? "bg-green-50 border-green-200 text-green-700"
                                            : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                                    )}
                                >
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    {copied ? 'Copied!' : 'Copy Debug Info'}
                                </button>
                            )}
                        </div>
                    </div>

                    {displayedResults.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                            <p className="font-medium">All checked entries are valid!</p>
                            <p className="text-sm">No failures to display.</p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <div className="max-h-[400px] overflow-auto">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-700 w-10">Status</th>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Association</th>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Team</th>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Level</th>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Events</th>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-700">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {displayedResults.map((result, index) => {
                                            const Icon = STATUS_ICONS[result.status];
                                            return (
                                                <tr key={index} className={cn("hover:bg-gray-50", STATUS_BG[result.status])}>
                                                    <td className="px-4 py-3">
                                                        <Icon className={cn("w-5 h-5", STATUS_COLORS[result.status])} />
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">
                                                        {result.association}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-900">{result.team}</td>
                                                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                                        {result.ageGroup} {result.levelDetail}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                                        {result.futureEvents} / {result.totalEvents}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-600">
                                                        {result.status === 'error' ? (
                                                            <span className="text-red-600">{result.error}</span>
                                                        ) : result.status === 'empty' ? (
                                                            <span className="text-amber-600">No future events</span>
                                                        ) : (
                                                            <span className="text-green-600">OK</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Debug Output Panel */}
            {failedResults.length > 0 && (
                <div className="bg-gray-900 shadow-sm rounded-lg p-6">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-100">Debug Output</h3>
                        <button
                            onClick={handleCopyDebug}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                                copied
                                    ? "bg-green-600 text-white"
                                    : "bg-gray-700 text-gray-200 hover:bg-gray-600"
                            )}
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'Copied!' : 'Copy to Clipboard'}
                        </button>
                    </div>
                    <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap max-h-[300px] overflow-auto bg-gray-800 rounded p-4">
                        {generateDebugOutput()}
                    </pre>
                </div>
            )}
        </div>
    );
}
