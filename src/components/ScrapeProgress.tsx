'use client';

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface ScrapeProgressProps {
    logs: string[];
    isScraping: boolean;
}

export function ScrapeProgress({ logs, isScraping }: ScrapeProgressProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold">Scraping Progress</h3>
                {isScraping && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
            </div>
            <div
                ref={scrollRef}
                className="h-64 overflow-y-auto font-mono text-sm bg-black text-green-400 p-3 rounded shadow-inner"
            >
                {logs.length === 0 ? (
                    <span className="text-gray-500 italic">Waiting to start...</span>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className="whitespace-pre-wrap break-words">
                            {log}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
