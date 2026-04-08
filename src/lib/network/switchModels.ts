// Switch Model Definitions and Utilities

export type SwitchModel = 'WS-C2960-24TT-L' | 'WS-C3560-24PS';
export type SwitchLayer = 'L2' | 'L3';

export interface SwitchModelInfo {
    model: SwitchModel;
    name: string;
    layer: SwitchLayer;
    ports: number;
    description: string;
    features: string[];
}

export const SWITCH_MODELS: Record<SwitchModel, SwitchModelInfo> = {
    'WS-C2960-24TT-L': {
        model: 'WS-C2960-24TT-L',
        name: 'Catalyst 2960 24-Port',
        layer: 'L2',
        ports: 24,
        description: 'Layer 2 Switch - Fastethernet ports only, no IP addressing on physical ports',
        features: [
            'Layer 2 Switching',
            'VLAN Support',
            'Spanning Tree Protocol',
            'Port Security',
            'Management VLAN (Vlan1) only'
        ]
    },
    'WS-C3560-24PS': {
        model: 'WS-C3560-24PS',
        name: 'Catalyst 3560 24-Port PoE',
        layer: 'L3',
        ports: 24,
        description: 'Layer 3 Switch - Supports IP addressing on physical ports and VLAN interfaces',
        features: [
            'Layer 3 Routing',
            'Layer 2 Switching',
            'IP Routing',
            'VLAN Interfaces',
            'Routed Ports',
            'Power over Ethernet (PoE)',
            'Port Security'
        ]
    }
};

export function getSwitchLayer(model: SwitchModel): SwitchLayer {
    return SWITCH_MODELS[model].layer;
}

export function getSwitchInfo(model: SwitchModel): SwitchModelInfo {
    return SWITCH_MODELS[model];
}

export function isLayer2Switch(model: SwitchModel | string | undefined): boolean {
    if (!model) return false;
    return getSwitchLayer(model as SwitchModel) === 'L2';
}

export function isLayer3Switch(model: SwitchModel | string | undefined): boolean {
    if (!model) return false;
    return getSwitchLayer(model as SwitchModel) === 'L3';
}

export function canAssignIPToPhysicalPort(model: SwitchModel | string | undefined): boolean {
    if (!model) return true; // Default to allowing IP assignment if model is unknown (for routers)
    return isLayer3Switch(model);
}

export function getAvailableSwitchModels(): SwitchModel[] {
    return Object.keys(SWITCH_MODELS) as SwitchModel[];
}
