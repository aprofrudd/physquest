// The Testing Lab's map tiles (ids 100-199): each is a 16x16 slice of the lab's shared art (rooms/testing/kit.ts),
// registered with the tile renderer when this module is imported.
import { registerTiles } from '../../render/TileMap';
import { LABX, TILE_ART, type TileArtName } from '../../rooms/testing/kit';

interface TileSpec {
  id: number;
  /** Blocks walking: furniture, machines, walls of cabinets. Floor, lane and lines are open. */
  solid: boolean;
}

const SPECS: Readonly<Record<TileArtName, TileSpec>> = {
  floor: { id: 100, solid: false },
  wall: { id: 101, solid: true },
  cabinet: { id: 102, solid: true },
  boardLeft: { id: 103, solid: true },
  boardRight: { id: 104, solid: true },
  windowLeft: { id: 105, solid: true },
  windowRight: { id: 106, solid: true },
  clock: { id: 107, solid: true },
  treadmillRearTop: { id: 135, solid: true },
  treadmillMidTop: { id: 136, solid: true },
  treadmillConsoleTop: { id: 137, solid: true },
  monitorLeft: { id: 138, solid: true },
  monitorRight: { id: 139, solid: true },
  treadmillRear: { id: 108, solid: true },
  treadmillMid: { id: 109, solid: true },
  treadmillConsole: { id: 110, solid: true },
  cartTop: { id: 111, solid: true },
  cartBase: { id: 112, solid: true },
  ergoTopLeft: { id: 113, solid: true },
  ergoTopRight: { id: 114, solid: true },
  ergoBottomLeft: { id: 115, solid: true },
  ergoBottomRight: { id: 116, solid: true },
  laneUpper: { id: 117, solid: false },
  laneLower: { id: 118, solid: false },
  startUpper: { id: 119, solid: false },
  startLower: { id: 120, solid: false },
  finishUpper: { id: 121, solid: false },
  finishLower: { id: 122, solid: false },
  gateUpper: { id: 123, solid: true },
  gateLower: { id: 124, solid: true },
  cone: { id: 125, solid: true },
  analyser: { id: 126, solid: true },
  rack: { id: 127, solid: true },
  laptop: { id: 128, solid: true },
  centrifuge: { id: 129, solid: true },
  log: { id: 130, solid: true },
  watches: { id: 131, solid: true },
  benchFront: { id: 132, solid: true },
  cooler: { id: 133, solid: true },
  plant: { id: 134, solid: true },
};

/** Tile ids by art name. */
export const TILE: Readonly<Record<TileArtName, number>> = Object.fromEntries(
  Object.entries(SPECS).map(([name, spec]) => [name, spec.id]),
) as Record<TileArtName, number>;

/** The floor under the technician: a floor tile that blocks walking (he stands there). */
export const TECH_SPOT = 140;

registerTiles({
  ...Object.fromEntries(
    (Object.keys(SPECS) as TileArtName[]).map(name => [
      SPECS[name].id,
      { pattern: TILE_ART[name] as number[][], solid: SPECS[name].solid, colors: LABX },
    ]),
  ),
  [TECH_SPOT]: { pattern: TILE_ART.floor as number[][], solid: true, colors: LABX },
});
