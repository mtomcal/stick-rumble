import { useCallback } from 'react';
import type { NetworkSimulatorStats } from '../../game/network/NetworkSimulator';

export interface DebugNetworkPanelProps {
  isVisible: boolean;
  onClose: () => void;
  stats: NetworkSimulatorStats;
  onLatencyChange: (latency: number) => void;
  onPacketLossChange: (packetLoss: number) => void;
  onEnabledChange: (enabled: boolean) => void;
}

export function DebugNetworkPanel({
  isVisible,
  onClose,
  stats,
  onLatencyChange,
  onPacketLossChange,
  onEnabledChange,
}: DebugNetworkPanelProps) {
  // Use stats directly instead of local state to avoid sync issues
  const { latency, packetLoss, enabled } = stats;

  const handleLatencyChange = useCallback(
    (value: number) => {
      onLatencyChange(value);
    },
    [onLatencyChange]
  );

  const handlePacketLossChange = useCallback(
    (value: number) => {
      onPacketLossChange(value);
    },
    [onPacketLossChange]
  );

  const handleEnabledChange = useCallback(
    (value: boolean) => {
      onEnabledChange(value);
    },
    [onEnabledChange]
  );

  if (!isVisible) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        border: '1px solid #444',
        borderRadius: '8px',
        padding: '16px',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: '14px',
        minWidth: '280px',
        zIndex: 1000,
      }}
      data-testid="debug-network-panel"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          borderBottom: '1px solid #444',
          paddingBottom: '8px',
        }}
      >
        <span style={{ fontWeight: 'bold' }}>Network Simulator (F8)</span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '0 4px',
          }}
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleEnabledChange(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            data-testid="enabled-checkbox"
          />
          <span>Enable Simulation</span>
          <span
            style={{
              marginLeft: 'auto',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: enabled ? '#2e7d32' : '#666',
              fontSize: '12px',
            }}
          >
            {enabled ? 'ON' : 'OFF'}
          </span>
        </label>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '4px',
          }}
        >
          <label htmlFor="latency-slider">Latency</label>
          <span style={{ color: enabled ? '#4fc3f7' : '#666' }}>{latency}ms</span>
        </div>
        <input
          id="latency-slider"
          type="range"
          min="0"
          max="300"
          value={latency}
          onChange={(e) => handleLatencyChange(Number(e.target.value))}
          disabled={!enabled}
          style={{
            width: '100%',
            cursor: enabled ? 'pointer' : 'not-allowed',
            opacity: enabled ? 1 : 0.5,
          }}
          data-testid="latency-slider"
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#888',
          }}
        >
          <span>0ms</span>
          <span>150ms</span>
          <span>300ms</span>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '4px',
          }}
        >
          <label htmlFor="packet-loss-slider">Packet Loss</label>
          <span style={{ color: enabled ? '#ff8a65' : '#666' }}>{packetLoss}%</span>
        </div>
        <input
          id="packet-loss-slider"
          type="range"
          min="0"
          max="20"
          value={packetLoss}
          onChange={(e) => handlePacketLossChange(Number(e.target.value))}
          disabled={!enabled}
          style={{
            width: '100%',
            cursor: enabled ? 'pointer' : 'not-allowed',
            opacity: enabled ? 1 : 0.5,
          }}
          data-testid="packet-loss-slider"
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#888',
          }}
        >
          <span>0%</span>
          <span>10%</span>
          <span>20%</span>
        </div>
      </div>

      {enabled && (
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            padding: '8px',
            fontSize: '12px',
          }}
          data-testid="stats-overlay"
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Active Simulation:</div>
          <div>
            Added latency: {latency}ms (±20ms jitter)
          </div>
          <div>Packet loss: {packetLoss}%</div>
        </div>
      )}

      <div
        style={{
          marginTop: '12px',
          fontSize: '11px',
          color: '#888',
          textAlign: 'center',
        }}
      >
        Press F8 to toggle • URL: ?latency=X&loss=Y
      </div>
    </div>
  );
}
