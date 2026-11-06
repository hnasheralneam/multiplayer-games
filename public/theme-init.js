// Runs before first paint so the saved theme applies without a flash.
// Kept as a separate file (not inline) because the app ships a strict CSP.
(() => {
  try {
    const saved = localStorage.getItem('ms:theme');
    const theme = saved === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const meta = document.getElementById('theme-color');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f7f6f3' : '#131417');
  } catch {
    document.documentElement.dataset.theme = 'light';
  }
})();
