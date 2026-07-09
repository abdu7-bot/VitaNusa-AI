export function initChatViewportController() {
  const root = document.documentElement;
  const chatLog = document.querySelector('[data-nusa-chat-log]');
  const chatInput = document.querySelector('[data-nusa-chat-input]');

  if (!root || !chatLog || !chatInput) return null;

  const getViewportHeight = () => {
    if (window.visualViewport?.height) {
      return window.visualViewport.height;
    }

    return window.innerHeight;
  };

  const applyViewportHeight = () => {
    const height = Math.max(320, Math.round(getViewportHeight()));
    root.style.setProperty('--nusa-viewport-height', `${height}px`);
  };

  const scrollChatToBottom = () => {
    window.requestAnimationFrame(() => {
      chatLog.scrollTop = chatLog.scrollHeight;
    });
  };

  const handleViewportChange = () => {
    applyViewportHeight();
    scrollChatToBottom();
  };

  applyViewportHeight();

  window.visualViewport?.addEventListener('resize', handleViewportChange);
  window.visualViewport?.addEventListener('scroll', handleViewportChange);
  window.addEventListener('resize', handleViewportChange);

  chatInput.addEventListener('focus', () => {
    handleViewportChange();
    setTimeout(scrollChatToBottom, 80);
    setTimeout(scrollChatToBottom, 220);
  });

  chatInput.addEventListener('input', scrollChatToBottom);

  return {
    refresh: handleViewportChange,
    destroy() {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
    },
  };
}
