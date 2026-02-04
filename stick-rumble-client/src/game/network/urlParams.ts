import type { NetworkSimulatorConfig } from './NetworkSimulator';

/**
 * Parse URL parameters for network simulation configuration.
 * Supports: ?latency=100&loss=5
 */
export function parseNetworkSimulatorParams(): NetworkSimulatorConfig | null {
  const params = new URLSearchParams(window.location.search);

  const latencyParam = params.get('latency');
  const lossParam = params.get('loss');

  // If no network params present, return null
  if (latencyParam === null && lossParam === null) {
    return null;
  }

  const config: NetworkSimulatorConfig = {
    enabled: false, // Will be enabled if any valid param is found
  };

  let hasValidParam = false;

  if (latencyParam !== null) {
    const latency = parseInt(latencyParam, 10);
    if (!isNaN(latency) && latency >= 0) {
      config.latency = latency;
      hasValidParam = true;
    }
  }

  if (lossParam !== null) {
    const packetLoss = parseInt(lossParam, 10);
    if (!isNaN(packetLoss) && packetLoss >= 0) {
      config.packetLoss = packetLoss;
      hasValidParam = true;
    }
  }

  // Enable if any valid param was found
  if (hasValidParam) {
    config.enabled = true;
    return config;
  }

  return null;
}
