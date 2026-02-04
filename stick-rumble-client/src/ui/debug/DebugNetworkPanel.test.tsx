import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DebugNetworkPanel, type DebugNetworkPanelProps } from './DebugNetworkPanel';
import type { NetworkSimulatorStats } from '../../game/network/NetworkSimulator';

describe('DebugNetworkPanel', () => {
  const defaultStats: NetworkSimulatorStats = {
    enabled: false,
    latency: 0,
    packetLoss: 0,
  };

  const defaultProps: DebugNetworkPanelProps = {
    isVisible: true,
    onClose: vi.fn(),
    stats: defaultStats,
    onLatencyChange: vi.fn(),
    onPacketLossChange: vi.fn(),
    onEnabledChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('visibility', () => {
    it('should render when isVisible is true', () => {
      render(<DebugNetworkPanel {...defaultProps} isVisible={true} />);
      expect(screen.getByTestId('debug-network-panel')).toBeInTheDocument();
    });

    it('should not render when isVisible is false', () => {
      render(<DebugNetworkPanel {...defaultProps} isVisible={false} />);
      expect(screen.queryByTestId('debug-network-panel')).not.toBeInTheDocument();
    });
  });

  describe('enable/disable toggle', () => {
    it('should display checkbox for enabling simulation', () => {
      render(<DebugNetworkPanel {...defaultProps} />);
      expect(screen.getByTestId('enabled-checkbox')).toBeInTheDocument();
    });

    it('should call onEnabledChange when checkbox is toggled', () => {
      const onEnabledChange = vi.fn();
      render(<DebugNetworkPanel {...defaultProps} onEnabledChange={onEnabledChange} />);

      const checkbox = screen.getByTestId('enabled-checkbox');
      fireEvent.click(checkbox);

      expect(onEnabledChange).toHaveBeenCalledWith(true);
    });

    it('should show OFF badge when disabled', () => {
      render(<DebugNetworkPanel {...defaultProps} stats={{ ...defaultStats, enabled: false }} />);
      expect(screen.getByText('OFF')).toBeInTheDocument();
    });

    it('should show ON badge when enabled', () => {
      render(<DebugNetworkPanel {...defaultProps} stats={{ ...defaultStats, enabled: true }} />);
      expect(screen.getByText('ON')).toBeInTheDocument();
    });
  });

  describe('latency slider', () => {
    it('should display latency slider', () => {
      render(<DebugNetworkPanel {...defaultProps} />);
      expect(screen.getByTestId('latency-slider')).toBeInTheDocument();
    });

    it('should display current latency value', () => {
      render(<DebugNetworkPanel {...defaultProps} stats={{ ...defaultStats, latency: 100 }} />);
      expect(screen.getByText('100ms')).toBeInTheDocument();
    });

    it('should call onLatencyChange when slider is moved', () => {
      const onLatencyChange = vi.fn();
      render(
        <DebugNetworkPanel
          {...defaultProps}
          stats={{ ...defaultStats, enabled: true }}
          onLatencyChange={onLatencyChange}
        />
      );

      const slider = screen.getByTestId('latency-slider');
      fireEvent.change(slider, { target: { value: '150' } });

      expect(onLatencyChange).toHaveBeenCalledWith(150);
    });

    it('should disable slider when simulation is disabled', () => {
      render(<DebugNetworkPanel {...defaultProps} stats={{ ...defaultStats, enabled: false }} />);
      expect(screen.getByTestId('latency-slider')).toBeDisabled();
    });

    it('should enable slider when simulation is enabled', () => {
      render(<DebugNetworkPanel {...defaultProps} stats={{ ...defaultStats, enabled: true }} />);
      expect(screen.getByTestId('latency-slider')).not.toBeDisabled();
    });
  });

  describe('packet loss slider', () => {
    it('should display packet loss slider', () => {
      render(<DebugNetworkPanel {...defaultProps} />);
      expect(screen.getByTestId('packet-loss-slider')).toBeInTheDocument();
    });

    it('should display current packet loss value', () => {
      // Use 7% since 10% is also in the slider labels
      render(<DebugNetworkPanel {...defaultProps} stats={{ ...defaultStats, packetLoss: 7 }} />);
      expect(screen.getByText('7%')).toBeInTheDocument();
    });

    it('should call onPacketLossChange when slider is moved', () => {
      const onPacketLossChange = vi.fn();
      render(
        <DebugNetworkPanel
          {...defaultProps}
          stats={{ ...defaultStats, enabled: true }}
          onPacketLossChange={onPacketLossChange}
        />
      );

      const slider = screen.getByTestId('packet-loss-slider');
      fireEvent.change(slider, { target: { value: '15' } });

      expect(onPacketLossChange).toHaveBeenCalledWith(15);
    });

    it('should disable slider when simulation is disabled', () => {
      render(<DebugNetworkPanel {...defaultProps} stats={{ ...defaultStats, enabled: false }} />);
      expect(screen.getByTestId('packet-loss-slider')).toBeDisabled();
    });
  });

  describe('stats overlay', () => {
    it('should show stats overlay when enabled', () => {
      render(
        <DebugNetworkPanel
          {...defaultProps}
          stats={{ enabled: true, latency: 100, packetLoss: 5 }}
        />
      );
      expect(screen.getByTestId('stats-overlay')).toBeInTheDocument();
    });

    it('should not show stats overlay when disabled', () => {
      render(<DebugNetworkPanel {...defaultProps} stats={{ ...defaultStats, enabled: false }} />);
      expect(screen.queryByTestId('stats-overlay')).not.toBeInTheDocument();
    });

    it('should display current simulation values in overlay', () => {
      // Use 7% since 10% is also in the slider labels
      render(
        <DebugNetworkPanel
          {...defaultProps}
          stats={{ enabled: true, latency: 175, packetLoss: 7 }}
        />
      );
      const overlay = screen.getByTestId('stats-overlay');
      expect(overlay).toHaveTextContent('175ms');
      expect(overlay).toHaveTextContent('7%');
    });
  });

  describe('close button', () => {
    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<DebugNetworkPanel {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: 'Close panel' });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('state sync with props', () => {
    it('should update internal state when stats prop changes', () => {
      const { rerender } = render(
        <DebugNetworkPanel {...defaultProps} stats={{ enabled: false, latency: 50, packetLoss: 2 }} />
      );

      expect(screen.getByText('50ms')).toBeInTheDocument();
      expect(screen.getByText('2%')).toBeInTheDocument();

      rerender(
        <DebugNetworkPanel {...defaultProps} stats={{ enabled: true, latency: 200, packetLoss: 15 }} />
      );

      expect(screen.getByText('200ms')).toBeInTheDocument();
      expect(screen.getByText('15%')).toBeInTheDocument();
    });
  });

  describe('help text', () => {
    it('should display F8 toggle hint', () => {
      render(<DebugNetworkPanel {...defaultProps} />);
      expect(screen.getByText(/Press F8 to toggle/)).toBeInTheDocument();
    });

    it('should display URL parameter hint', () => {
      render(<DebugNetworkPanel {...defaultProps} />);
      expect(screen.getByText(/URL:.*latency.*loss/)).toBeInTheDocument();
    });
  });
});
