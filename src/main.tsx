import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App.tsx';
// Fonts are bundled with the app (SIL Open Font License), so no font requests leave the device.
import '@fontsource-variable/inter';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/700.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Motion animations follow the device's reduced-motion setting. */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
