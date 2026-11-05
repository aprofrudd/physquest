// The player's name in game text: lines write {NAME} and it is filled at render time (with the button tokens, by
// fillButtonNames, and by announce). The game points the source at gameState.playerName once at start.

let source: () => string = () => '';

/** Where {NAME} comes from (the game: () => gameState.playerName). */
export const setNameSource = (get: () => string): void => {
  source = get;
};

/** Said when no name has been entered yet (never in normal play: name entry comes first). */
const FALLBACK = 'Scientist';

/** The typed name (A-Z, 0-9, '.', '-') as a name in a sentence: ALAN -> Alan, MC-KAY -> Mc-Kay. */
export const spokenName = (raw: string): string => {
  const name = raw.trim();
  if (!name) return FALLBACK;
  return name.toLowerCase().replace(/(^|[\s.-])([a-z])/g, (_, before: string, ch: string) => before + ch.toUpperCase());
};

const NAME_TOKEN = /\{NAME\}/g;

/** Replace {NAME} in `text` with the player's name. Text without the token is returned as it is. */
export const fillName = (text: string): string => (text.includes('{NAME}') ? text.replace(NAME_TOKEN, spokenName(source())) : text);
