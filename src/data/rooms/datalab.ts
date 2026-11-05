// Redesigned Data Lab (palette `data`, a dark control room): a video wall of results along the top, workstations
// with analysts on the left, server racks on the right, the athlete at the results desk beside the printer.
// The tiles are in datalab-tiles.ts and everything that moves is in datalab-life.ts.
import { T } from '../../render/TileMap';
import { partsOf } from '../../rooms/datalab/names';
import type { EquipData, MapData } from '../maps';
import { DL } from './datalab-tiles';
import { WALL_SCREEN_AT, dataLabLife } from './datalab-life';

const { FLOOR: F, SEAT: S, WALL_A: WA, WALL_B: WB, CONSOLE_L: CL, CONSOLE_R: CR, DESK_L: DL_, DESK_R: DR, RACK_TOP: RT, RACK_BOTTOM: RB } = DL;
const { PRINTER: PR, CABLE: CB, PLANT: PL, RESULTS_L: RL, RESULTS_R: RR } = DL;
const { WALL_TOP: WT, WALL_LEFT: LW, WALL_RIGHT: RW, WALL_CORNER_TL: TL, WALL_CORNER_TR: TR, WALL_CORNER_BL: BL, WALL_CORNER_BR: BR, DOOR: D, NPC: N } = T;

/**
 * 16 x 14. S = a seated analyst (solid floor, drawn by datalab-life.ts), N = the athlete (the overworld draws
 * her), CB = floor cable (walk-on), run from the racks to just east of the way in so the coach never starts on it,
 * the wall rows 1-2 are the video wall's backing.
 */
const TILES: number[][] = [
  [TL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, TR],
  [LW, WA, WA, WA, WA, WA, WA, WA, WA, WA, WA, WA, WA, WA, WA, RW],
  [LW, WB, WB, WB, WB, WB, WB, WB, WB, WB, WB, WB, WB, WB, WB, RW],
  [LW, F, F, F, F, F, F, F, F, F, F, F, F, F, F, RW],
  [LW, F, CL, CR, F, CL, CR, F, F, F, F, F, F, RT, RT, RW],
  [LW, F, DL_, DR, F, DL_, DR, F, F, F, CL, CR, F, RB, RB, RW],
  [LW, F, S, F, F, F, S, F, F, F, RL, RR, F, RT, RT, RW],
  [LW, F, F, F, F, F, F, F, F, F, N, F, PR, RB, RB, RW],
  [LW, F, CL, CR, F, F, F, F, F, F, F, F, F, RT, RT, RW],
  [LW, F, DL_, DR, F, F, F, F, F, F, F, F, F, RB, RB, RW],
  [LW, F, F, S, F, F, F, F, CB, CB, CB, CB, CB, CB, CB, RW],
  [LW, F, F, F, F, F, F, F, F, F, F, F, F, F, PL, RW],
  [LW, F, F, F, F, F, F, D, F, F, F, F, F, F, F, RW],
  [BL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, BR],
];

/** Things to look at: each entry is a tile (solid or not) whose faced press shows the lines for its key. */
const EQUIPMENT: EquipData[] = [];
const look = (key: string, tiles: ReadonlyArray<readonly [number, number]>) => {
  for (const [x, y] of tiles) EQUIPMENT.push({ x, y, dialogueKey: key });
};

// The workstations keep the lab's existing screen lines
look('room2_screen1', [[2, 4], [3, 4], [2, 5], [3, 5]]);
look('room2_screen2', [[5, 4], [6, 4], [5, 5], [6, 5]]);
look('room2_screen3', [[2, 8], [3, 8], [2, 9], [3, 9]]);
look('room2_screen4', [[10, 5], [11, 5]]);
// The results desk and the printer (no numbers: see talk)
look('datalab_data', [[10, 6], [11, 6], [12, 7]]);
// Each wall screen names its variable (no value: it would show a number from a test that may not have been run)
for (let slot = 0; slot < 5; slot++) {
  look(`datalab_wall${slot}`, Object.entries(WALL_SCREEN_AT).filter(([, s]) => s === slot).map(([x]) => [Number(x), 2] as const));
}

export const DATA_LAB: MapData = {
  name: 'Data Lab',
  palette: 'data',
  tiles: TILES,
  npcFloor: DL.FLOOR,
  npcs: [{ x: 10, y: 7, dialogueKey: 'room2_athlete' }],
  equipment: EQUIPMENT,
  doors: [{ x: 7, y: 12, target: 'hub' }],
  life: dataLabLife,
  talk: {
    // No numbers out here: the files depend on which tests were run, and the room shows only those (rooms/datalab)
    datalab_data: () => ['Results desk: the files from your tests load here.'],
    datalab_wall0: sport => wallLine(sport.variables[0]?.name),
    datalab_wall1: sport => wallLine(sport.variables[1]?.name),
    datalab_wall2: sport => wallLine(sport.variables[2]?.name),
    datalab_wall3: sport => wallLine(sport.variables[3]?.name),
    datalab_wall4: sport => wallLine(sport.variables[4]?.name),
  },
  describe:
    'A video wall of results along the top, workstations on the left, server racks on the right, the athlete at the results desk.',
};

function wallLine(name: string | undefined): string[] {
  return name ? [`Data screen: ${partsOf(name).words}.`] : [];
}
