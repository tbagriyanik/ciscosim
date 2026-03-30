'use client';

import React, { useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { SWITCH_MODELS, SwitchModel, getAvailableSwitchModels } from '@/lib/network/switchModels';
import { Layers, Check } from 'lucide-react';

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
    const availableModels = getAvailableSwitchModels();

    const handleSelect = () => {
        onSelect(selectedModel);
    };

    const translations = {
        tr: {
            title: 'Switch Modeli Seçin',
            description: 'Ağ simülatörü için kullanılacak switch modelini seçin',
            layer2: 'Layer 2 (Switching)',
            layer3: 'Layer 3 (Routing)',
            select: 'Seç',
            cancel: 'İptal',
        },
        en: {
            title: 'Select Switch Model',
            description: 'Choose the switch model to use in the network simulator',
            layer2: 'Layer 2 (Switching)',
            layer3: 'Layer 3 (Routing)',
            select: 'Select',
            cancel: 'Cancel',
        }
    };

    const t = translations[language];

    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => {
            if (!open) onCancel();
        }}>
            <AlertDialogContent className="max-w-2xl max-h-96 overflow-y-auto">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <Layers className="w-5 h-5" />
                        {t.title}
                    </AlertDialogTitle>
                    <AlertDialogDescription>{t.description}</AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-3 my-4">
                    {availableModels.map((model) => {
                        const info = SWITCH_MODELS[model];
                        const isSelected = selectedModel === model;
                        return (
                            <div
                                key={model}
                                onClick={() => setSelectedModel(model)}
                                className={`p-3 border rounded-lg cursor-pointer transition-all ${isSelected
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm">{info.name}</span>
                                        <Badge variant={info.layer === 'L2' ? 'secondary' : 'default'} className="text-xs">
                                            {info.layer === 'L2' ? t.layer2 : t.layer3}
                                        </Badge>
                                        {isSelected && <Check className="w-4 h-4 text-blue-500" />}
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{info.description}</p>
                            </div>
                        );
                    })}
                </div>

                <div className="flex gap-2 justify-end">
                    <AlertDialogCancel onClick={onCancel}>
                        {t.cancel}
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={handleSelect}>
                        {t.select}
                    </AlertDialogAction>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
}
