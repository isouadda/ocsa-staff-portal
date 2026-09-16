import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import HomeScreenPrompt from './HomeScreenPrompt';
import { applyCanonicalRedirect } from './canonicalRedirect';

// Before anything renders. On the host being retired this replaces the
// address and the page unloads; everywhere else it does nothing.
applyCanonicalRedirect();

const root = ReactDOM.createRoot(document.getElementById('root'));
// The home screen prompt sits beside the app, once, so it can appear on
// every screen including sign in without touching any screen's code.
root.render(<React.StrictMode><App /><HomeScreenPrompt /></React.StrictMode>);

// Production only. The worker caches nothing; see public/sw.js.
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(process.env.PUBLIC_URL + '/sw.js').catch(() => {});
  });
}
