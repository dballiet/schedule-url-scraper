'use client';

import { useState, useRef } from 'react';
import { AssociationSelector } from '@/components/AssociationSelector';
import { ScrapeProgress } from '@/components/ScrapeProgress';
import { ResultsTable } from '@/components/ResultsTable';
import { CsvTeamRecord } from '@/lib/csv-utils';
import { Play, Upload, Download, FileCheck } from 'lucide-react';

interface ProgressData {
  current: number;
  total: number;
  associationName: string;
  teamsFound: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
}

interface ComparisonStats {
  totalTeams: number;
  newTeams?: number;
  changedTeams?: number;
  missingTeams?: number;
  unchangedTeams?: number;
}

export default function Home() {
  const [selectedAssociations, setSelectedAssociations] = useState<string[]>([]);
  const [masterCsv, setMasterCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isScraping, setIsScraping] = useState(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [stats, setStats] = useState<ComparisonStats | null>(null);
  const [csvData, setCsvData] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setMasterCsv(event.target?.result as string);
      setLogs(prev => [...prev, `✓ Loaded master CSV: ${file.name}`]);
    };
    reader.readAsText(file);
  };

  const startScraping = async () => {
    if (selectedAssociations.length === 0) return;

    setIsScraping(true);
    setLogs([]);
    setProgress(null);
    setStats(null);
    setCsvData('');

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          associations: selectedAssociations,
          masterCsv
        }),
      });

      if (!response.ok) throw new Error('Failed to start scraping');
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

            if (data.type === 'status') {
              setLogs(prev => [...prev, data.message]);
            } else if (data.type === 'progress') {
              setProgress(data);
            } else if (data.type === 'complete') {
              setStats(data);
              setLogs(prev => [...prev, '✅ Scraping completed!']);
            } else if (data.type === 'csv') {
              setCsvData(data.data);
            } else if (data.type === 'error') {
              setLogs(prev => [...prev, `❌ ERROR: ${data.message}`]);
            }
          } catch (e) {
            console.error('Failed to parse line:', line, e);
          }
        }
      }
    } catch (error) {
      console.error('Scraping error:', error);
      setLogs(prev => [...prev, `❌ FATAL ERROR: ${error}`]);
    } finally {
      setIsScraping(false);
    }
  };

  const downloadCsv = () => {
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hockey-teams-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadChangesOnly = () => {
    if (!csvData) return;

    // Parse CSV and filter for changes
    const lines = csvData.split('\n');
    const header = lines[0];
    const changed = lines.filter((line, idx) =>
      idx === 0 || line.includes(',new,') || line.includes(',url_changed,') || line.includes(',missing,')
    );

    const blob = new Blob([changed.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hockey-teams-changes-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <main className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Hockey Association Calendar Scraper</h1>
          <p className="mt-2 text-gray-600">Select associations, optionally upload a master CSV for comparison, and scrape team calendars.</p>
        </div>

        {/* Master CSV Upload */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-blue-600" />
            Master CSV (Optional)
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Upload your existing CSV to detect changes. If not uploaded, a fresh CSV will be generated.
          </p>
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-white border-2 border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:border-blue-500 hover:text-blue-600 transition-all"
            >
              <Upload className="w-4 h-4" />
              {fileName || 'Choose File'}
            </button>
            {fileName && (
              <button
                onClick={() => {
                  setMasterCsv(null);
                  setFileName('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-sm text-red-600 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Association Selector */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          <AssociationSelector
            selected={selectedAssociations}
            onChange={setSelectedAssociations}
          />

          <div className="mt-6 flex justify-end">
            <button
              onClick={startScraping}
              disabled={isScraping || selectedAssociations.length === 0}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isScraping ? 'Scraping...' : 'Start Scraping'}
              {!isScraping && <Play className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Progress Indicator */}
        {progress && (
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Scraping Progress</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Association {progress.current} of {progress.total}: {progress.associationName}</span>
                <span>{progress.teamsFound} teams found</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Elapsed: {formatTime(progress.elapsedMs)}</span>
                <span>Est. Remaining: {formatTime(progress.estimatedRemainingMs)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Logs */}
        {(isScraping || logs.length > 0) && (
          <ScrapeProgress logs={logs} isScraping={isScraping} />
        )}

        {/* Stats & Download */}
        {stats && csvData && (
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Scrape Results</h3>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">{stats.totalTeams}</div>
                <div className="text-xs text-gray-600">Total Teams</div>
              </div>
              {stats.newTeams !== undefined && (
                <>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 mb-1">{stats.newTeams}</div>
                    <div className="text-xs text-gray-600">New</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600 mb-1">{stats.changedTeams}</div>
                    <div className="text-xs text-gray-600">Changed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600 mb-1">{stats.missingTeams}</div>
                    <div className="text-xs text-gray-600">Missing</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600 mb-1">{stats.unchangedTeams}</div>
                    <div className="text-xs text-gray-600">Unchanged</div>
                  </div>
                </>
              )}
            </div>

            {/* Download Buttons */}
            <div className="flex gap-3">
              <button
                onClick={downloadCsv}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-all"
              >
                <Download className="w-4 h-4" />
                Download Full CSV
              </button>
              {stats.newTeams !== undefined && (stats.newTeams > 0 || stats.changedTeams! > 0 || stats.missingTeams! > 0) && (
                <button
                  onClick={downloadChangesOnly}
                  className="flex items-center gap-2 bg-orange-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-orange-700 transition-all"
                >
                  <Download className="w-4 h-4" />
                  Download Changes Only
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
