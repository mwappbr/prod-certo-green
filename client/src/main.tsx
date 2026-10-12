import './theme.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ListingProvider } from './features/listing/ListingProvider';
import { CommentTreeProvider } from './features/detail/CommentTreeProvider';
import { ThemeProvider } from './features/theme/ThemeProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ListingProvider>
        <CommentTreeProvider>
          <App />
        </CommentTreeProvider>
      </ListingProvider>
    </ThemeProvider>
  </StrictMode>,
);
