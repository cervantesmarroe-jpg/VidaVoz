export { DWELL_MS } from "./dwell";
import { DWELL_MS } from "./dwell";

// Aliases retro-compatibles — todos apuntan al mismo valor central.
export const MSG_DWELL_MS = DWELL_MS;
export const TAB_DWELL_MS = DWELL_MS;

// Sonido de confirmación desactivado — feedback solo visual/haptic
export function playBell() { /* silenciado */ }
