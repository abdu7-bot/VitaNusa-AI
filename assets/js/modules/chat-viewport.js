const KEYBOARD_ACTIVE_THRESHOLD = 80;
const MOBILE_QUERY = '(max-width: 860px)';

export function initChatViewportController() {
  const root = document.documentElement;
  const body = document.body;
  const chatLog = document.querySelector('[data-nusa-chat-log]');
  const chatInput = document.querySelector('[data-nusa-chat-input]');
  const mobileMedia = window.matchMedia?.(MOBILE_QUERY);

  if (!root || !body || !chatLog || !chatInput) return null;

  const isMobileLayout = () => mobileMedia?.matches ?? window.innerWidth <= 860;

  const getViewportMetrics = () => {
    const layoutHeight = window.innerHeight || root.clientHeight || 0;
    const visualViewport = window.visualViewport;

    if (visualViewport?.height) {
      const height = visualViewport.height;
      const offsetTop = visualViewport.offsetTop || 0;
      const keyboardInset = Math.max(0, layoutHeight - height - offsetTop);

      return { height, offsetTop, keyboardInset };
    }

    return {
      height: layoutHeight,
      offsetTop: 0,
      keyboardInset: 0,
    };
  };

  const scrollChatToBottom = () => {
    window.requestAnimationFrame(() => {
      chatLog.scrollTop = chatLog.scrollHeight;
    });
  };

  const applyViewportMetrics = () => {
    const { height, offsetTop, keyboardInset } = getViewportMetrics();
    const viewportHeight = Math.max(320, Math.round(height));
    const viewportOffsetTop = Math.max(0, Math.round(offsetTop));
    const viewportKeyboardBottom = Math.max(0, Math.round(keyboardInset));
    const inputFocused = document.activeElement === chatInput;
    const keyboardLikelyActive = inputFocused || viewportKeyboardBottom > KEYBOARD_ACTIVE_THRESHOLD;

    root.style.setProperty('--nusa-viewport-height', `${viewportHeight}px`);
    root.style.setProperty('--nusa-visual-offset-top', `${viewportOffsetTop}px`);
    root.style.setProperty('--nusa-keyboard-bottom', `${viewportKeyboardBottom}px`);

    root.classList.toggle('nusa-chat-viewport-managed', isMobileLayout());
    root.classList.toggle('nusa-keyboard-active', isMobileLayout() && keyboardLikelyActive);
  };

  const handleViewportChange = () => {
    applyViewportMetrics();
    scrollChatToBottom();
  };

  const handleTouchMove = (event) => {
    if (!root.classList.contains('nusa-keyboard-active')) return;
    if (chatLog.contains(event.target)) return;

    event.preventDefault();
  };

  applyViewportMetrics();

  window.visualViewport?.addEventListener('resize', handleViewportChange);
  window.visualViewport?.addEventListener('scroll', handleViewportChange);
  window.addEventListener('resize', handleViewportChange);
  mobileMedia?.addEventListener?.('change', handleViewportChange);
  document.addEventListener('touchmove', handleTouchMove, { passive: false });

  chatInput.addEventListener('focus', () => {
    handleViewportChange();
    setTimeout(handleViewportChange, 80);
    setTimeout(handleViewportChange, 220);
    setTimeout(scrollChatToBottom, 320);
  });

  chatInput.addEventListener('blur', () => {
    setTimeout(handleViewportChange, 120);
  });

  chatInput.addEventListener('input', scrollChatToBottom);

  return {
    refresh: handleViewportChange,
    destroy() {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
      mobileMedia?.removeEventListener?.('change', handleViewportChange);
      document.removeEventListener('touchmove', handleTouchMove);
      root.classList.remove('nusa-chat-viewport-managed', 'nusa-keyboard-active');
      root.style.removeProperty('--nusa-viewport-height');
      root.style.removeProperty('--nusa-visual-offset-top');
      root.style.removeProperty('--nusa-keyboard-bottom');
    },
  };
}
