const KEYBOARD_ACTIVE_THRESHOLD = 80;
const MOBILE_QUERY = '(max-width: 860px)';
const VIEWPORT_CONTROLLERS = new WeakMap();

export function initChatViewportController({
  rootElement = null,
  rootSelector = '[data-nusa-chat]',
} = {}) {
  const chatRoot = rootElement || document.querySelector(rootSelector);
  if (!chatRoot) return null;
  if (VIEWPORT_CONTROLLERS.has(chatRoot)) return VIEWPORT_CONTROLLERS.get(chatRoot);

  const root = document.documentElement;
  const body = document.body;
  const chatLog = chatRoot.querySelector('[data-nusa-chat-log]');
  const chatInput = chatRoot.querySelector('[data-nusa-chat-input]');
  const mobileMedia = window.matchMedia?.(MOBILE_QUERY);

  if (!root || !body || !chatLog || !chatInput) return null;

  const isMobileLayout = () => mobileMedia?.matches ?? window.innerWidth <= 860;
  const isVisible = () => !chatRoot.closest('[hidden]');

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
    const controllerActive = isVisible();
    const keyboardLikelyActive = controllerActive
      && (inputFocused || viewportKeyboardBottom > KEYBOARD_ACTIVE_THRESHOLD);

    root.style.setProperty('--nusa-viewport-height', `${viewportHeight}px`);
    root.style.setProperty('--nusa-visual-offset-top', `${viewportOffsetTop}px`);
    root.style.setProperty('--nusa-keyboard-bottom', `${viewportKeyboardBottom}px`);

    root.classList.toggle('nusa-chat-viewport-managed', controllerActive && isMobileLayout());
    root.classList.toggle('nusa-keyboard-active', isMobileLayout() && keyboardLikelyActive);
  };

  const handleViewportChange = () => {
    applyViewportMetrics();
    if (isVisible()) scrollChatToBottom();
  };

  const handleTouchMove = (event) => {
    if (!root.classList.contains('nusa-keyboard-active')) return;
    if (!isVisible() || chatLog.contains(event.target)) return;
    event.preventDefault();
  };

  const handleFocus = () => {
    handleViewportChange();
    window.setTimeout(handleViewportChange, 80);
    window.setTimeout(handleViewportChange, 220);
    window.setTimeout(scrollChatToBottom, 320);
  };

  const handleBlur = () => {
    window.setTimeout(handleViewportChange, 120);
  };

  applyViewportMetrics();

  window.visualViewport?.addEventListener('resize', handleViewportChange);
  window.visualViewport?.addEventListener('scroll', handleViewportChange);
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('orientationchange', handleViewportChange);
  mobileMedia?.addEventListener?.('change', handleViewportChange);
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  chatInput.addEventListener('focus', handleFocus);
  chatInput.addEventListener('blur', handleBlur);
  chatInput.addEventListener('input', scrollChatToBottom);

  const controller = {
    refresh: handleViewportChange,
    destroy() {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
      mobileMedia?.removeEventListener?.('change', handleViewportChange);
      document.removeEventListener('touchmove', handleTouchMove);
      chatInput.removeEventListener('focus', handleFocus);
      chatInput.removeEventListener('blur', handleBlur);
      chatInput.removeEventListener('input', scrollChatToBottom);
      root.classList.remove('nusa-chat-viewport-managed', 'nusa-keyboard-active');
      root.style.removeProperty('--nusa-viewport-height');
      root.style.removeProperty('--nusa-visual-offset-top');
      root.style.removeProperty('--nusa-keyboard-bottom');
      VIEWPORT_CONTROLLERS.delete(chatRoot);
    },
  };

  VIEWPORT_CONTROLLERS.set(chatRoot, controller);
  return controller;
}
