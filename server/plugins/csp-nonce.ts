import { addScriptNonce, buildCsp, createCspNonce } from '../utils/csp';

// A fresh nonce for every rendered page, on the scripts Nuxt inlines and in
// the CSP header (the security middleware sets the policy without one)
export default defineNitroPlugin((nitroApp) => {
  if (import.meta.dev) return;

  nitroApp.hooks.hook('render:html', (html, { event }) => {
    const nonce = createCspNonce();
    html.head = html.head.map((chunk) => addScriptNonce(chunk, nonce));
    html.bodyAppend = html.bodyAppend.map((chunk) => addScriptNonce(chunk, nonce));
    setResponseHeader(event, 'Content-Security-Policy', buildCsp(nonce));
  });
});
