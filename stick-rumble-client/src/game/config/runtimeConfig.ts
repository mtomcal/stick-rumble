import type { JoinIntent } from '../../shared/types';

const INVITE_PARAM = 'invite';

function getDefaultWebSocketUrl(): string {
  if (typeof globalThis !== 'undefined' && globalThis.location?.hostname) {
    const protocol = globalThis.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${globalThis.location.hostname}:8080/ws`;
  }

  return 'ws://localhost:8080/ws';
}

export function getWebSocketUrl(): string {
  return import.meta.env.VITE_WS_URL || getDefaultWebSocketUrl();
}

export function getClientBaseUrl(): string {
  const configured = import.meta.env.VITE_CLIENT_BASE_URL;
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }

  return 'http://localhost:5173';
}

export function getInviteCodeFromLocation(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const invite = params.get(INVITE_PARAM);
  return invite && invite.trim() ? invite : null;
}

export function buildInviteLink(code: string): string {
  return `${getClientBaseUrl()}/?invite=${encodeURIComponent(code)}`;
}

export function formatReconnectLabel(intent: JoinIntent | null): string {
  if (!intent || intent.mode !== 'code' || !intent.code) {
    return 'Retry';
  }

  return `Retry ${intent.code}`;
}
