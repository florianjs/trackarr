/**
 * Honeypots: paths and form fields no real user ever touches.
 *
 * Trackarr serves no PHP, no WordPress and no dotfiles, so a request for one
 * is a scanner looking for something to exploit. The hidden form field is
 * invisible to people and skipped by password managers (meaningless name);
 * bots filling every input fill it too.
 */

const TRAP_PATHS = [
  // Dotfiles and VCS metadata (secrets, source)
  /^\/\.(env|git|svn|hg|aws|ssh|htaccess|htpasswd|ds_store|npmrc|docker)(\/|\.|$)/i,
  // Admin panels and frameworks this app does not run
  /^\/(wp-admin|wp-includes|wp-content|phpmyadmin|pma|myadmin|cgi-bin|vendor\/phpunit|actuator|boaform)(\/|$)/i,
  // Server-side scripts of other stacks
  /\.(php|asp|aspx|jsp|cgi)$/i,
  // Path traversal targets and appliance exploits
  /^\/(etc|proc|sys)\//i,
  /^\/(server-status|hnap1)$/i,
];

export function isHoneypotPath(path: string): boolean {
  const pathname = path.split('?')[0] ?? '';
  return TRAP_PATHS.some((trap) => trap.test(pathname));
}

/** Name of the hidden form field (login, register) */
export const HONEYPOT_FIELD = 'hpot_field';

export function isHoneypotFilled(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}
