//#region lib/types/index.js
/**
 * Host companion for the desktop-tweaks Client plugin.
 *
 * Every behavior lives in the browser half (`lib/client.js`); this entry only
 * exists so the package appears in the profile's cordis entry table, which is
 * what makes `dsh.client` discoverable by the web module scanner.
 */
export const name = 'dsh-desktop-tweaks'

/** Host plugin body — no host-side behavior for this plugin. */
export function apply() {}
//#endregion
