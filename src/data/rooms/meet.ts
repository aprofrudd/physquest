// The ATHLETE room (Distance Running): a calm consultation room where the player first meets the athlete and gets
// to know her (Phase 1 of the scientific support process: the athlete overview). A window, a whiteboard, a clock,
// a kit shelf and a framed race bib along the back wall; a table with a notebook and two mugs on a teal rug, a chair
// either side; the athlete stands by her chair. Tiles in meet-tiles.ts, moving parts in meet-life.ts.
import { T } from '../../render/TileMap';
import type { MapData } from '../maps';
import type { SportData } from '../sports';
import { MEET } from './meet-tiles';
import { MEET_SPOTS, drawMeetLife } from './meet-life';

const TL = T.WALL_CORNER_TL;
const TR = T.WALL_CORNER_TR;
const BL = T.WALL_CORNER_BL;
const BR = T.WALL_CORNER_BR;
const WT = T.WALL_TOP;
const WL = T.WALL_LEFT;
const WR = T.WALL_RIGHT;
const D = T.DOOR;
const N = T.NPC;

const F = MEET.floor;
const WA = MEET.wall;
const WNL = MEET.windowLeft;
const WNR = MEET.windowRight;
const BDL = MEET.boardLeft;
const BDR = MEET.boardRight;
const CK = MEET.clock;
const SHL = MEET.shelfLeft;
const SHR = MEET.shelfRight;
const BIB = MEET.bib;
const TBL = MEET.tableLeft;
const TBR = MEET.tableRight;
const CH = MEET.chair;
const RG = MEET.rug;
const PL = MEET.plant;

/** The athlete's first name, from the level's profile ("Aisha, 26, 5000m runner. ..."). */
export const athleteFirstName = (sport: SportData): string => sport.athleteProfile.split(',')[0]?.trim() || 'the athlete';

export const MEET_ROOM: MapData = {
  name: 'Athlete Room',
  palette: 'office',
  tiles: [
    [TL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, TR],
    [WL, WA, WNL, WNR, WA, BDL, BDR, WA, CK, WA, SHL, SHR, WA, BIB, WA, WR],
    [WL, PL, F, F, F, F, F, F, F, F, F, F, F, F, PL, WR],
    [WL, F, F, F, F, F, F, F, F, F, F, F, F, F, F, WR],
    [WL, F, F, F, F, RG, RG, RG, RG, RG, RG, F, F, F, F, WR],
    [WL, F, F, F, F, RG, RG, RG, RG, RG, RG, F, F, F, F, WR],
    [WL, F, F, F, F, RG, CH, TBL, TBR, CH, RG, F, F, F, F, WR],
    [WL, F, F, F, F, RG, RG, RG, RG, N, RG, F, F, F, F, WR],
    [WL, F, F, F, F, RG, RG, RG, RG, RG, RG, F, F, F, F, WR],
    [WL, F, F, F, F, F, F, F, F, F, F, F, F, F, F, WR],
    [WL, PL, F, F, F, F, F, F, F, F, F, F, F, F, PL, WR],
    [WL, F, F, F, F, F, F, F, F, F, F, F, F, F, F, WR],
    [WL, F, F, F, F, F, F, D, F, F, F, F, F, F, F, WR],
    [BL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, BR],
  ],
  // Beside her chair, on the rug; the chair above her stays bare for the "!" bubble
  npcs: [{ x: MEET_SPOTS.athlete.x, y: MEET_SPOTS.athlete.y, dialogueKey: 'meet_athlete' }],
  npcFloor: RG,
  equipment: [
    { x: 7, y: 6, dialogueKey: 'meet_notebook' },
    { x: 8, y: 6, dialogueKey: 'meet_notebook' },
    { x: 6, y: 6, dialogueKey: 'meet_chair' },
    { x: 9, y: 6, dialogueKey: 'meet_chair' },
    { x: 2, y: 1, dialogueKey: 'meet_window' },
    { x: 3, y: 1, dialogueKey: 'meet_window' },
    { x: 5, y: 1, dialogueKey: 'meet_board' },
    { x: 6, y: 1, dialogueKey: 'meet_board' },
    { x: 8, y: 1, dialogueKey: 'meet_clock' },
    { x: 10, y: 1, dialogueKey: 'meet_kit' },
    { x: 11, y: 1, dialogueKey: 'meet_kit' },
    { x: 13, y: 1, dialogueKey: 'meet_bib' },
  ],
  doors: [{ x: 7, y: 12, target: 'hub' }],
  life: (ctx, t) => drawMeetLife(ctx, t),
  talk: {
    meet_notebook: sport => [`Your notebook. What you learn about ${athleteFirstName(sport)} goes in here.`],
    meet_chair: sport => [`A comfy chair. Talk to ${athleteFirstName(sport)} to start the chat.`],
    meet_window: () => ['The track outside, under a big sky.'],
    meet_board: () => ['The whiteboard says: PHASE 1, ATHLETE OVERVIEW. Goals, support, needs, life, history, training, the basics.'],
    meet_clock: () => ['There is time for a proper chat.'],
    meet_kit: () => ['A kit shelf: racing spikes, a foam roller, a medal, a bottle and a stopwatch.'],
    meet_bib: () => ['A framed race bib.'],
  },
  describe:
    'A calm consultation room. A window, a whiteboard, a clock, a kit shelf and a framed race bib along the back wall. In the middle, a table with a notebook and two mugs on a teal rug, a chair either side. The athlete stands beside her chair, right of the table.',
};
