import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock PhaserGame component
vi.mock('./ui/common/PhaserGame', () => ({
  PhaserGame: () => <div data-testid="phaser-game-mock">Phaser Game</div>,
}));

describe('App', () => {
  it('should render the main app container', () => {
    const { container } = render(<App />);
    const appContainer = container.querySelector('.app-container');

    expect(appContainer).toBeDefined();
    expect(appContainer).not.toBeNull();
  });

  it('should render the game title', () => {
    render(<App />);

    const title = screen.getByText(/Stick Rumble - Multiplayer Arena Shooter/i);
    expect(title).toBeDefined();
  });

  it('should render title as h1 element', () => {
    render(<App />);

    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toBeDefined();
    expect(title.textContent).toBe('Stick Rumble - Multiplayer Arena Shooter');
  });

  it('should render title with centered text alignment', () => {
    render(<App />);

    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveStyle({ textAlign: 'center' });
  });

  it('should render title with white color', () => {
    render(<App />);

    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveStyle({ color: '#ffffff' });
  });

  it('should render PhaserGame component', () => {
    render(<App />);

    const phaserGame = screen.getByTestId('phaser-game-mock');
    expect(phaserGame).toBeDefined();
  });

  it('should render components in correct order', () => {
    const { container } = render(<App />);

    const appContainer = container.querySelector('.app-container');
    expect(appContainer?.children).toHaveLength(2);

    // First child should be h1
    expect(appContainer?.children[0].tagName).toBe('H1');

    // Second child should be the PhaserGame (mocked as div)
    expect(appContainer?.children[1].getAttribute('data-testid')).toBe('phaser-game-mock');
  });
});
