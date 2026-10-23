// The redesigned rooms are switched on per browser while their physiology content is under review:
// ?rooms=new turns them on (remembered on this device), ?rooms=classic turns them off again.

const STORAGE_KEY = 'physquest_rooms';

/** Levels whose four rooms have been redesigned, by level index. Distance Running is first. */
export const REDESIGNED_LEVELS: ReadonlySet<number> = new Set([3]);

/** Flip to true once the content is approved, so every player gets the redesigned rooms. */
const ON_BY_DEFAULT = false;

type Choice = 'new' | 'classic';

const asChoice = (value: string | null): Choice | null => (value === 'new' || value === 'classic' ? value : null);

const choose = (): boolean => {
  let fromUrl: Choice | null = null;
  try {
    fromUrl = asChoice(new URLSearchParams(window.location.search).get('rooms'));
  } catch {
    // no window (unit tests): the default applies
  }
  let stored: Choice | null = null;
  try {
    if (fromUrl) localStorage.setItem(STORAGE_KEY, fromUrl);
    stored = asChoice(localStorage.getItem(STORAGE_KEY));
  } catch {
    // storage blocked: the URL alone decides, for this visit
  }
  const choice = fromUrl ?? stored;
  return choice ? choice === 'new' : ON_BY_DEFAULT;
};

let enabled: boolean | null = null;

/** Whether this browser plays the redesigned rooms (decided once per page load). */
export const newRoomsOn = (): boolean => (enabled ??= choose());

/** Whether `level`'s rooms are the redesigned ones for this player. */
export const roomsRedesigned = (level: number): boolean => REDESIGNED_LEVELS.has(level) && newRoomsOn();
