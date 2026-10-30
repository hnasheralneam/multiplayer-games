import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, currentTheme } from './lib/theme';
import './styles.css';

applyTheme(currentTheme());

const root = document.getElementById('root');
if (!root) throw new Error('Missing root element');
createRoot(root).render(<App />);
