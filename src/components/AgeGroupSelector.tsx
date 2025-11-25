'use client';

import { AGE_GROUPS, AgeGroup } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AgeGroupSelectorProps {
    selected: AgeGroup[];
    onChange: (groups: AgeGroup[]) => void;
}

export function AgeGroupSelector({ selected, onChange }: AgeGroupSelectorProps) {
    const toggle = (group: AgeGroup) => {
        if (selected.includes(group)) {
            onChange(selected.filter(g => g !== group));
        } else {
            onChange([...selected, group]);
        }
    };

    const selectAll = () => onChange([...AGE_GROUPS]);
    const clearAll = () => onChange([]);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Age Groups</h3>
                <div className="space-x-2 text-sm">
                    <button onClick={selectAll} className="text-blue-600 hover:underline">Select All</button>
                    <span className="text-gray-300">|</span>
                    <button onClick={clearAll} className="text-blue-600 hover:underline">Clear</button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {AGE_GROUPS.map(group => (
                    <button
                        key={group}
                        type="button"
                        onClick={() => toggle(group)}
                        className={cn(
                            'px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
                            selected.includes(group)
                                ? 'bg-blue-50 border-blue-500 text-blue-700'
                                : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
                        )}
                    >
                        {group}
                    </button>
                ))}
            </div>
        </div>
    );
}
