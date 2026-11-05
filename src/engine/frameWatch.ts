// Tells whether a rendered frame differs from the one before it, without reading pixels back: every call on the game's
// 2D context (every method, every style setter) is folded into a running hash for the frame, with its arguments
// (numbers and strings by value, canvases, patterns and gradients by identity). Two frames that issue the same calls in
// the same order with the same arguments draw the same pixels, because every scene clears the screen first and every
// offscreen canvas it blits (glyphs, sprites, tile maps, backdrops) is painted once and never changed afterwards. The
// game loop uses it to skip present() (the upscaled copy to the on-page canvas, the costly part on a phone) when
// nothing on screen moved. Hashing allocates nothing per call.

export interface FrameWatch {
  /** Start a frame's hash. */
  begin(): void;
  /** End the frame: true when it differs from the previous one (always true for the first). */
  changed(): boolean;
}

// Methods that only read, or make objects without drawing: their calls leave the pixels alone
const PURE = new Set([
  'constructor',
  'getImageData',
  'measureText',
  'isPointInPath',
  'isPointInStroke',
  'getTransform',
  'getContextAttributes',
  'getLineDash',
  'isContextLost',
  'createImageData',
  'createLinearGradient',
  'createRadialGradient',
  'createConicGradient',
  'createPattern',
]);

const FNV = 0x01000193;

/** Wraps `ctx` (in place) so its calls are hashed per frame. */
export const watchFrames = (ctx: CanvasRenderingContext2D): FrameWatch => {
  let hash = 0x811c9dc5;
  let last = -1;
  let first = true;
  const ids = new WeakMap<object, number>();
  let nextId = 1;

  const mixInt = (v: number) => {
    hash = Math.imul(hash ^ v, FNV);
  };
  const mix = (v: unknown) => {
    switch (typeof v) {
      case 'number':
        // Sub-pixel positions matter (a fractional fade); 1/4096 px is far below anything visible
        mixInt(Number.isFinite(v) ? Math.round(v * 4096) | 0 : 0x7fc00000);
        break;
      case 'string':
        mixInt(v.length);
        for (let i = 0; i < v.length; i++) mixInt(v.charCodeAt(i));
        break;
      case 'boolean':
        mixInt(v ? 0x51 : 0x50);
        break;
      case 'object':
      case 'function':
        if (v === null) {
          mixInt(0x4e);
        } else {
          let id = ids.get(v as object);
          if (id === undefined) {
            id = nextId++;
            ids.set(v as object, id);
          }
          mixInt(0x4f000000 + id);
        }
        break;
      default:
        mixInt(0x55); // undefined
    }
  };

  // Each wrapped member gets a number, mixed in before its arguments
  let memberId = 0;
  const target = ctx as unknown as Record<string, unknown>;
  const seen = new Set<string>();
  for (let proto = Object.getPrototypeOf(ctx); proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (seen.has(name) || PURE.has(name)) continue;
      seen.add(name);
      const desc = Object.getOwnPropertyDescriptor(proto, name);
      if (!desc) continue;
      const id = ++memberId * 0x9e3779b1;
      if (typeof desc.value === 'function') {
        const fn = desc.value as (...args: unknown[]) => unknown;
        Object.defineProperty(target, name, {
          configurable: true,
          writable: true,
          value: function (this: unknown) {
            mixInt(id);
            // eslint-disable-next-line prefer-rest-params
            for (let i = 0; i < arguments.length; i++) mix(arguments[i]);
            // eslint-disable-next-line prefer-rest-params
            return fn.apply(this, arguments as unknown as unknown[]);
          },
        });
      } else if (desc.set) {
        const get = desc.get;
        const set = desc.set;
        Object.defineProperty(target, name, {
          configurable: true,
          get: get ? function (this: unknown) {
            return get.call(this);
          } : undefined,
          set(this: unknown, v: unknown) {
            mixInt(id);
            mix(v);
            set.call(this, v);
          },
        });
      }
    }
  }

  return {
    begin() {
      hash = 0x811c9dc5;
    },
    changed() {
      const differs = first || hash !== last;
      first = false;
      last = hash;
      return differs;
    },
  };
};
