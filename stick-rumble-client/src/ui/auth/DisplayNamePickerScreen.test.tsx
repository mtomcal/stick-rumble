import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DisplayNamePickerScreen } from './DisplayNamePickerScreen';

// Mock fetch for PUT /api/player/displayname
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock runtimeConfig to control getApiBaseUrl
vi.mock('../../game/config/runtimeConfig', () => ({
  getApiBaseUrl: () => '/api',
}));

describe('DisplayNamePickerScreen', () => {
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful PUT by default
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ displayName: 'TestPlayer' }),
    });
  });

  it('renders display name input', () => {
    render(<DisplayNamePickerScreen token="test-token" onConfirm={mockOnConfirm} />);
    expect(screen.getByPlaceholderText(/enter.*name/i)).toBeDefined();
  });

  it('shows error for empty name', () => {
    render(<DisplayNamePickerScreen token="test-token" onConfirm={mockOnConfirm} />);
    fireEvent.click(screen.getByText(/confirm/i));
    expect(screen.getByText(/name.*required/i)).toBeDefined();
  });

  it('shows error for name over 16 chars', () => {
    render(<DisplayNamePickerScreen token="test-token" onConfirm={mockOnConfirm} />);
    const input = screen.getByPlaceholderText(/enter.*name/i);
    fireEvent.change(input, { target: { value: 'ThisNameIsWayTooLongForDisplay' } });
    fireEvent.click(screen.getByText(/confirm/i));
    expect(screen.getByText('Max 16 characters')).toBeDefined();
  });

  it('calls onConfirm with sanitized name on valid submission', async () => {
    render(<DisplayNamePickerScreen token="test-token" onConfirm={mockOnConfirm} />);
    const input = screen.getByPlaceholderText(/enter.*name/i);
    fireEvent.change(input, { target: { value: 'MyName' } });
    fireEvent.click(screen.getByText(/confirm/i));
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/player/displayname', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        body: JSON.stringify({ displayName: 'MyName' }),
      });
    });
  });

  it('shows loading state during submission', async () => {
    // Don't resolve the fetch immediately
    mockFetch.mockImplementation(() => new Promise(() => {}));
    render(<DisplayNamePickerScreen token="test-token" onConfirm={mockOnConfirm} />);
    const input = screen.getByPlaceholderText(/enter.*name/i);
    fireEvent.change(input, { target: { value: 'MyName' } });
    fireEvent.click(screen.getByText(/confirm/i));
    
    await waitFor(() => {
      expect(screen.getByText(/saving/i)).toBeDefined();
    });
  });

  it('shows error and does not call onConfirm when server returns error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'bad name' }),
    });
    render(<DisplayNamePickerScreen token="test-token" onConfirm={mockOnConfirm} />);
    const input = screen.getByPlaceholderText(/enter.*name/i);
    fireEvent.change(input, { target: { value: 'MyName' } });
    fireEvent.click(screen.getByText(/confirm/i));

    await waitFor(() => {
      expect(screen.getByText(/Failed to save name/i)).toBeDefined();
    });
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });
});
