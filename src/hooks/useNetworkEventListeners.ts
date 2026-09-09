import { useEffect, useRef } from 'react';
import type { SwitchState } from '@/lib/network/types';
import type { CanvasDevice, CanvasConnection } from '@/components/network/networkTopology.types';
import { isSwitchDeviceType } from '@/app/refreshNetworkUtils';
import type { TabType } from '@/app/page.types';
import { recalculateStp, computeStpTopologyChanges } from '@/lib/network/stp';
import { detectEtherChannelBundles, computeEtherChannelChanges } from '@/lib/network/etherchannel';
import { learnMacsOnNewConnection } from '@/lib/network/macLearning';
import { useAppStore } from '@/lib/store/appStore';

interface UseNetworkEventListenersParams {
  setDeviceStates: React.Dispatch<React.SetStateAction<Map<string, SwitchState>>>;
  deviceStates: Map<string, SwitchState>;
  activeTabRef: React.MutableRefObject<string>;
  setActiveTab: (tab: TabType) => void;
}

export function useNetworkEventListeners(params: UseNetworkEventListenersParams) {
  const { setDeviceStates, deviceStates, activeTabRef, setActiveTab } = params;
  const addNetworkEventLog = useAppStore(state => state.addNetworkEventLog);

  // Last-seen topology connections, used to diff EtherChannel bundle membership
  // across cable power / deletion events (the event itself only carries the new list).
  const prevTopologyConnectionsRef = useRef<CanvasConnection[] | undefined>(undefined);

  useEffect(() => {
    const handleVtpPropagation = (e: Event) => {
      const customEvent = e as CustomEvent<{
        deviceId: string;
        topologyDevices: CanvasDevice[];
        topologyConnections: CanvasConnection[];
        deviceStates: Map<string, SwitchState>;
      }>;
      const { topologyDevices: eventDevices, topologyConnections: eventConnections, deviceStates: eventStates } = customEvent.detail;

      if (!eventDevices || !eventConnections || !eventStates) return;

      const byId = new Map(eventDevices.map((d: CanvasDevice) => [d.id, d]));
      const nextStates = new Map(eventStates);

      for (const conn of eventConnections) {
        if (!conn.active) continue;
        const a = byId.get(conn.sourceDeviceId);
        const b = byId.get(conn.targetDeviceId);
        if (!a || !b) continue;
        if (!isSwitchDeviceType(a.type) || !isSwitchDeviceType(b.type)) continue;

        const aState = nextStates.get(a.id);
        const bState = nextStates.get(b.id);
        if (!aState || !bState) continue;

        const aPort = aState.ports?.[conn.sourcePort];
        const bPort = bState.ports?.[conn.targetPort];
        const aIsTrunk = !!aPort && !aPort.shutdown && aPort.mode === 'trunk';
        const bIsTrunk = !!bPort && !bPort.shutdown && bPort.mode === 'trunk';
        if (!aIsTrunk || !bIsTrunk) continue;

        const aMode = aState.vtpMode || 'server';
        const bMode = bState.vtpMode || 'server';
        const aDomain = (aState.vtpDomain || '').trim();
        const bDomain = (bState.vtpDomain || '').trim();
        if (!aDomain || !bDomain) continue;
        if (aDomain !== bDomain) continue;

        const aRev = aState.vtpRevision || 0;
        const bRev = bState.vtpRevision || 0;

        if (aMode === 'server' && bMode === 'client' && aRev >= bRev) {
          nextStates.set(b.id, { ...bState, vlans: { ...aState.vlans }, vtpRevision: aRev });
        } else if (bMode === 'server' && aMode === 'client' && bRev >= aRev) {
          nextStates.set(a.id, { ...aState, vlans: { ...bState.vlans }, vtpRevision: bRev });
        }
      }

      setDeviceStates(nextStates);
    };
    window.addEventListener('vtp-propagation-needed', handleVtpPropagation);

    const handleSTPRecalculation = (event: Event) => {
      const { topologyConnections: updatedConnections } = (event as CustomEvent).detail;
      if (updatedConnections) {
        const prevStates = deviceStates;
        const allUpdatedStates = recalculateStp(prevStates, updatedConnections);
        for (const change of computeStpTopologyChanges(prevStates, allUpdatedStates)) {
          const isForwardingTransition =
            change.type === 'port-state-change' &&
            (change.newState === 'forwarding' || change.oldState === 'forwarding');
          addNetworkEventLog({
            level: change.type === 'root-bridge-change' || isForwardingTransition ? 'warning' : 'info',
            category: 'STP',
            message: change.message,
            detail: change.detail,
          });
        }

        // EtherChannel member fail / recovery: diff bundles across the connection change.
        const firstRun = prevTopologyConnectionsRef.current === undefined;
        if (!firstRun) {
          const prevBundles = detectEtherChannelBundles(prevTopologyConnectionsRef.current!, prevStates);
          const nextBundles = detectEtherChannelBundles(updatedConnections, allUpdatedStates);
          for (const change of computeEtherChannelChanges(prevBundles, nextBundles)) {
            addNetworkEventLog({
              level: change.level,
              category: 'EtherChannel',
              message: change.message,
              detail: change.detail,
            });
          }
        }
        prevTopologyConnectionsRef.current = updatedConnections;

        setDeviceStates(allUpdatedStates);
      }
    };
    window.addEventListener('stp-recalculation-needed', handleSTPRecalculation as EventListener);

    // When a cable is plugged in (new connection), switches immediately learn
    // the peer device's source MAC on the connecting port.
    const handleConnectionCreated = (event: Event) => {
      const detail = (event as CustomEvent<{
        connection: CanvasConnection;
        topologyDevices: CanvasDevice[];
      }>).detail;
      if (!detail?.connection || !detail.topologyDevices) return;

      const nextStates = learnMacsOnNewConnection(deviceStates, detail.connection, detail.topologyDevices);
      setDeviceStates(nextStates);
    };
    window.addEventListener('connection-created', handleConnectionCreated);

    const handleBeforePrint = () => {
      if (activeTabRef.current !== 'topology') {
        setActiveTab('topology');
      }
    };
    window.addEventListener('beforeprint', handleBeforePrint);

    return () => {
      window.removeEventListener('vtp-propagation-needed', handleVtpPropagation);
      window.removeEventListener('stp-recalculation-needed', handleSTPRecalculation);
      window.removeEventListener('connection-created', handleConnectionCreated);
      window.removeEventListener('beforeprint', handleBeforePrint);
    };
  }, [setDeviceStates, deviceStates, activeTabRef, setActiveTab, addNetworkEventLog]);
}
