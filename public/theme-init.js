// Runs before first paint so the saved theme applies without a flash.
// Kept as a separate file (not inline) because the app ships a strict CSP.
(() => {
  try {
    const saved = localStorage.getItem('ms:theme');
    const light = saved ? saved === 'light' : window.matchMedia('(prefers-color-scheme: light)').matches;
    const theme = light ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const meta = document.getElementById('theme-color');
    if (meta) meta.setAttribute('content', light ? '#f4f0e8' : '#0b0e13');
  } catch {
    document.documentElement.dataset.theme = 'dark';
  }
})();
