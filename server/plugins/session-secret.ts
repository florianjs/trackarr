import { sessionSecretProblem } from '../utils/sessionSecret';

// Refuse to start in production with a missing, short or placeholder session
// password, rather than fail at the first login or run with forgeable cookies
export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV !== 'production') return;
  const problem = sessionSecretProblem(process.env.NUXT_SESSION_PASSWORD);
  if (problem) {
    console.error(`[Security] ${problem}`);
    process.exit(1);
  }
});
