import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

/**
 * ConnectionIndicator Component
 * Renders real-time WebSocket connection state.
 * States: CONNECTED | CONNECTING | DISCONNECTED | ERROR
 */
export function ConnectionIndicator({ status = 'CONNECTED', label = null }) {
  const isConnected = status === 'CONNECTED';
  const isConnecting = status === 'CONNECTING';
  const isDisconnected = status === 'DISCONNECTED' || status === 'ERROR';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.04em',
        background: isConnected
          ? 'rgba(16, 185, 129, 0.12)'
          : isConnecting
          ? 'rgba(245, 158, 11, 0.12)'
          : 'rgba(239, 68, 68, 0.12)',
        border: `1px solid ${
          isConnected
            ? 'rgba(16, 185, 129, 0.3)'
            : isConnecting
            ? 'rgba(245, 158, 11, 0.3)'
            : 'rgba(239, 68, 68, 0.3)'
        }`,
        color: isConnected ? '#34D399' : isConnecting ? '#FBBF24' : '#F87171',
      }}
    >
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: isConnected ? '#10B981' : isConnecting ? '#F59E0B' : '#EF4444',
          boxShadow: isConnected
            ? '0 0 8px #10B981'
            : isConnecting
            ? '0 0 8px #F59E0B'
            : '0 0 8px #EF4444',
          display: 'inline-block',
        }}
      />
      {label || (isConnected ? 'Live Sync' : isConnecting ? 'Connecting...' : 'Offline')}
    </div>
  );
}

export default ConnectionIndicator;
