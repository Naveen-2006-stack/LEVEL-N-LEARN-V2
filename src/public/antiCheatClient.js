/**
 * LevelNLearn V2 - Real-Time Anti-Cheat Client Engine
 * Detects tab switching, window blurring, viewport exit, and context menu usage.
 * Features debouncing and clean event listener cleanup on unmount.
 */

export class AntiCheatMonitor {
  constructor({ socket, roomPin, playerId, debounceMs = 1000, onViolationEmitted }) {
    this.socket = socket;
    this.roomPin = roomPin;
    this.playerId = playerId;
    this.debounceMs = debounceMs;
    this.onViolationEmitted = onViolationEmitted || null;

    this.lastEmittedTimes = new Map(); // breachType -> timestamp
    this.isActive = false;

    // Bound event handlers for clean unmounting
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
  }

  /**
   * Helper to check and trigger a debounced breach event.
   */
  triggerViolation(breachType) {
    if (!this.isActive) return;

    const now = Date.now();
    const lastTime = this.lastEmittedTimes.get(breachType) || 0;

    if (now - lastTime < this.debounceMs) {
      return; // Suppress duplicate triggers within debounce window
    }

    this.lastEmittedTimes.set(breachType, now);

    const payload = {
      event: 'violation_detected',
      roomPin: this.roomPin,
      data: {
        playerId: this.playerId,
        breach_type: breachType,
        timestamp: now,
      },
    };

    // Emit WebSocket payload if socket connection is open
    if (this.socket && (this.socket.readyState === 1 || typeof this.socket.send === 'function')) {
      this.socket.send(JSON.stringify(payload));
    }

    if (typeof this.onViolationEmitted === 'function') {
      this.onViolationEmitted({ breachType, timestamp: now });
    }
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.triggerViolation('TAB_SWITCH');
    }
  }

  handleWindowBlur() {
    this.triggerViolation('WINDOW_BLUR');
  }

  handleMouseLeave(event) {
    // Check if cursor truly exited the top/bottom/sides of window viewport
    if (
      event.clientY <= 0 ||
      event.clientX <= 0 ||
      event.clientX >= window.innerWidth ||
      event.clientY >= window.innerHeight
    ) {
      this.triggerViolation('VIEWPORT_EXIT');
    }
  }

  handleContextMenu(event) {
    // Prevent right-click inspect menu if configured and log breach
    this.triggerViolation('CONTEXT_MENU');
  }

  /**
   * Attaches debounced event listeners to window and document.
   */
  attach() {
    if (this.isActive) return;
    this.isActive = true;

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('blur', this.handleWindowBlur);
    document.addEventListener('mouseleave', this.handleMouseLeave);
    document.addEventListener('contextmenu', this.handleContextMenu);

    console.log(`[Anti-Cheat] Monitor attached for player ${this.playerId}`);
  }

  /**
   * Cleans up all event listeners on unmount.
   */
  detach() {
    if (!this.isActive) return;
    this.isActive = false;

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleWindowBlur);
    document.removeEventListener('mouseleave', this.handleMouseLeave);
    document.removeEventListener('contextmenu', this.handleContextMenu);

    console.log(`[Anti-Cheat] Monitor detached and cleaned up for player ${this.playerId}`);
  }

  /**
   * Alias for destroy on unmount
   */
  destroy() {
    this.detach();
  }
}
