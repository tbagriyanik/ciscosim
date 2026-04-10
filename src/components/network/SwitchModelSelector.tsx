'use client';

import React, { useState, useMemo } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { SWITCH_MODELS, SwitchModel, getAvailableSwitchModels } from '@/lib/network/switchModels';
import { Check, Search, Layers, X } from 'lucide-react';

interface SwitchModelSelectorProps {
    isOpen: boolean;
    onSelect: (model: SwitchModel) => void;
    onCancel: () => void;
    currentModel?: SwitchModel;
    language?: 'tr' | 'en';
}

export function SwitchModelSelector({
    isOpen,
    onSelect,
    onCancel,
    currentModel = 'WS-C2960-24TT-L',
    language = 'en'
}: SwitchModelSelectorProps) {
    const [selectedModel, setSelectedModel] = useState<SwitchModel>(currentModel);
    const [searchQuery, setSearchQuery] = useState('');
    const availableModels = getAvailableSwitchModels();

    const filteredModels = useMemo(() => {
        if (!searchQuery.trim()) return availableModels;
        const query = searchQuery.toLowerCase();
        return availableModels.filter(model => {
            const info = SWITCH_MODELS[model];
            return (
                model.toLowerCase().includes(query) ||
                info.name.toLowerCase().includes(query) ||
                info.layer.toLowerCase().includes(query) ||
                info.description.toLowerCase().includes(query)
            );
        });
    }, [availableModels, searchQuery]);

    const handleSelect = () => {
        onSelect(selectedModel);
    };

    const translations = {
        tr: {
            title: 'Cihaz Seçimi',
            placeholder: 'Ara... (model, layer, isim)',
            layer2: 'Layer 2 (Switching)',
            layer3: 'Layer 3 (Routing)',
            select: 'Seç',
            cancel: 'İptal',
            noResults: 'Sonuç bulunamadı',
        },
        en: {
            title: 'Device Selection',
            placeholder: 'Search... (model, layer, name)',
            layer2: 'Layer 2 (Switching)',
            layer3: 'Layer 3 (Routing)',
            select: 'Select',
            cancel: 'Cancel',
            noResults: 'No results found',
        }
    };

    const t = translations[language];

    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
                setSearchQuery('');
                onCancel();
            }
        }}>
            <AlertDialogContent className="max-w-2xl max-h-[500px] overflow-hidden flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900">
                        <Layers className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div className="flex-1">
                        <h2 className="font-bold text-lg">{t.title}</h2>
                    </div>
                </div>
                
                <div className="mb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t.placeholder}
                            className="w-full pl-10 pr-10 py-2.5 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 border-slate-200 dark:border-slate-700"
                            autoFocus
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 my-2">
                    {filteredModels.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <Search className="w-12 h-12 mb-3 opacity-30" />
                            <p className="text-sm">{t.noResults}</p>
                        </div>
                    ) : (
                        filteredModels.map((model) => {
                            const info = SWITCH_MODELS[model];
                            const isSelected = selectedModel === model;
                            const isL3 = info.layer === 'L3';
                            return (
                                <div
                                    key={model}
                                    onClick={() => setSelectedModel(model)}
                                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                                        isSelected
                                            ? isL3
                                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-950 shadow-md shadow-purple-500/20'
                                                : 'border-green-500 bg-green-50 dark:bg-green-950 shadow-md shadow-green-500/20'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <svg className={`w-5 h-5 ${isL3 ? 'text-purple-500' : 'text-green-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2M5 12a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2m-2-4h.01M17 16h.01" />
                                            </svg>
                                            <span className="font-bold text-sm">{info.name}</span>
                                            <Badge 
                                                variant="outline" 
                                                className={`text-xs font-semibold ${
                                                    isL3 
                                                        ? 'border-purple-300 text-purple-700 bg-purple-100 dark:border-purple-700 dark:text-purple-300 dark:bg-purple-900' 
                                                        : 'border-green-300 text-green-700 bg-green-100 dark:border-green-700 dark:text-green-300 dark:bg-green-900'
                                                }`}
                                            >
                                                {info.layer === 'L2' ? t.layer2 : t.layer3}
                                            </Badge>
                                            {isSelected && (
                                                <Check className={`w-5 h-5 ${isL3 ? 'text-purple-500' : 'text-green-500'}`} />
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground font-mono">{model}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2 pl-7">{info.description}</p>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="flex gap-2 justify-end pt-3 border-t mt-2">
                    <AlertDialogCancel onClick={onCancel} className="px-4">
                        {t.cancel}
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={handleSelect} className="px-4 bg-cyan-600 hover:bg-cyan-700">
                        {t.select}
                    </AlertDialogAction>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
}
