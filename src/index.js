import React from 'react';
import ReactDOM from 'react-dom/client';
import App, { LastResort } from './App';
import HomeScreenPrompt from './HomeScreenPrompt';
import { applyCanonicalRedirect } from './canonicalRedirect';

// Before anything renders. On the host being retired this replaces the
// address and the page unloads; everywhere else it does nothing.
applyCanonicalRedirect();

const root = ReactDOM.createRoot(document.getElementById('root'));
// The home screen prompt sits beside the app, once, and waits for the
// portal itself before it offers. Both sit inside the last resort, which
// draws one line and Reload in place of a blank page when a render throws.
root.render(<React.StrictMode><LastResort><App /><HomeScreenPrompt /></LastResort></React.StrictMode>);

// Production only. The worker keeps the public /sds page for a phone with
// no signal, and nothing else; see public/sw.js.
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(process.env.PUBLIC_URL + '/sw.js').catch(() => {});
  });
}
