import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom React Hook: useAntiCheat (Anti-Cheat Engine V2)
 * 
 * Provides client-side monitoring for tab switching, window blurring,
 * viewport exits, clipboard manipulation, context menu right-clicking,
 * and hotkeys (PrintScreen, Ctrl+P, Ctrl+S, Cmd+Shift+4).
 * 
 * @param {Object} options Configuration options
 * @param {number} options.debounceMs Debounce interval in ms (default: 1000)
 * @param {boolean} options.enabled Whether anti-cheat monitoring is active (default: true)
 * @returns {Object} { violations, isObscured, resetObscured, clearViolations }
 */
export function useAntiCheat({ debounceMs = 1000, enabled = true, onViolation = null } = {}) {
  const [violations, setViolations] = useState([]);
  const [isObscured, setIsObscured] = useState(false);

  // Map to store timestamp of last emitted violation per breach type
  const lastEmittedTimes = useRef(new Map());

  /**
   * Helper to log breach violation with a 1000ms debounce guard per breach type.
   */
  const recordBreach = useCallback((breachType, triggerObscured = false) => {
    if (!enabled) return;

    const now = Date.now();
    const lastTime = lastEmittedTimes.current.get(breachType) || 0;

    if (now - lastTime < debounceMs) {
      if (triggerObscured) setIsObscured(true);
      return; // Suppress duplicate triggers within debounce window
    }

    lastEmittedTimes.current.set(breachType, now);

    const breachRecord = {
      breach_type: breachType,
      timestamp: now,
    };

    setViolations((prev) => [...prev, breachRecord]);
    
    if (onViolation) {
      onViolation(breachType);
    }

    if (triggerObscured) {
      setIsObscured(true);
    }
  }, [debounceMs, enabled, onViolation]);

  /**
   * Reset the visual blur state manually (e.g. user clicks "I am back").
   */
  const resetObscured = useCallback(() => {
    setIsObscured(false);
  }, []);

  /**
   * Reset all accumulated violations array.
   */
  const clearViolations = useCallback(() => {
    setViolations([]);
    lastEmittedTimes.current.clear();
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // 1. Tab Visibility Change (TAB_SWITCH)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordBreach('TAB_SWITCH', true);
      }
    };

    // 2. Window Blur / Defocus (WINDOW_BLUR)
    const handleWindowBlur = () => {
      recordBreach('WINDOW_BLUR', true);
    };

    // 3. Cursor Viewport Bounds (VIEWPORT_EXIT)
    const handleMouseLeave = (e) => {
      if (
        e.clientY <= 0 ||
        e.clientX <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {
        recordBreach('VIEWPORT_EXIT', false);
      }
    };

    // 4. Clipboard Interception (CLIPBOARD_ATTEMPT)
    const handleClipboard = (e) => {
      e.preventDefault();
      recordBreach('CLIPBOARD_ATTEMPT', false);
    };

    // 5. Context Menu Interception (RIGHT_CLICK_ATTEMPT)
    const handleContextMenu = (e) => {
      e.preventDefault();
      recordBreach('RIGHT_CLICK_ATTEMPT', false);
    };

    // 6. Hotkeys & Screen Snapping (SCREENSHOT_OR_PRINT_HOTKEY)
    const handleKeyDown = (e) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      const key = e.key;

      // PrintScreen key
      const isPrintScreen = key === 'PrintScreen';
      // Ctrl+P / Cmd+P (Print)
      const isPrintHotkey = isCmdOrCtrl && (key === 'p' || key === 'P');
      // Ctrl+S / Cmd+S (Save Page)
      const isSaveHotkey = isCmdOrCtrl && (key === 's' || key === 'S');
      // Cmd+Shift+4 or Cmd+Shift+3 (macOS Screenshot)
      const isMacScreenshot = (e.metaKey && e.shiftKey && (key === '4' || key === '3' || key === '5'));
      // Ctrl+Shift+I / Cmd+Option+I (Inspect element)
      const isInspectHotkey = isCmdOrCtrl && e.shiftKey && (key === 'I' || key === 'i');

      if (isPrintScreen || isPrintHotkey || isSaveHotkey || isMacScreenshot || isInspectHotkey) {
        e.preventDefault();
        recordBreach('SCREENSHOT_OR_PRINT_HOTKEY', true);
      }
    };

    // Attach all event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('copy', handleClipboard);
    document.addEventListener('cut', handleClipboard);
    document.addEventListener('paste', handleClipboard);
    document.addEventListener('selectstart', handleClipboard);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup all listeners on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('copy', handleClipboard);
      document.removeEventListener('cut', handleClipboard);
      document.removeEventListener('paste', handleClipboard);
      document.removeEventListener('selectstart', handleClipboard);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, recordBreach]);

  return {
    violations,
    isObscured,
    resetObscured,
    clearViolations,
  };
}
