'use client';

import { useState } from 'react';
import { ASSOCIATIONS } from '@/lib/associations';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssociationSelectorProps {
    selected: string[];
    onChange: (selected: string[]) => void;
}

export function AssociationSelector({ selected, onChange }: AssociationSelectorProps) {
    const toggleSelection = (name: string) => {
        if (selected.includes(name)) {
            onChange(selected.filter(s => s !== name));
        } else {
            onChange([...selected, name]);
        }
    };

    const selectAll = () => onChange(ASSOCIATIONS.map(a => a.name));
    const clearAll = () => onChange([]);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Select Associations</h2>
                <div className="space-x-2 text-sm">
                    <button onClick={selectAll} className="text-blue-600 hover:underline">Select All</button>
                    <span className="text-gray-300">|</span>
                    <button onClick={clearAll} className="text-blue-600 hover:underline">Clear</button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {ASSOCIATIONS.map((assoc) => (
                    <div
                        key={assoc.name}
                        onClick={() => toggleSelection(assoc.name)}
                        className={cn(
                            "cursor-pointer border rounded-lg p-4 flex items-center justify-between transition-colors",
                            selected.includes(assoc.name)
                                ? "bg-blue-50 border-blue-500"
                                : "bg-white border-gray-200 hover:border-blue-300"
                        )}
                    >
                        <span className="font-medium">{assoc.name}</span>
                        {selected.includes(assoc.name) && (
                            <Check className="w-5 h-5 text-blue-600" />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
