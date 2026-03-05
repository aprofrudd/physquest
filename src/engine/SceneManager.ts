import type { Scene } from './GameLoop';

export type SceneId = 'title' | 'intro' | 'levelSelect' | 'overworld' | 'roomChallenge' | 'bossBattle' | 'levelClear';

export const createSceneManager = () => {
  const scenes = new Map<SceneId, Scene>();
  let current: Scene | null = null;
  let currentId: SceneId | null = null;

  return {
    register(id: SceneId, scene: Scene) {
      scenes.set(id, scene);
    },

    switchTo(id: SceneId) {
      if (current?.onExit) current.onExit();
      const next = scenes.get(id);
      if (!next) throw new Error(`Scene "${id}" not registered`);
      current = next;
      currentId = id;
      if (current.onEnter) current.onEnter();
    },

    getCurrent(): Scene | null {
      return current;
    },

    getCurrentId(): SceneId | null {
      return currentId;
    },
  };
};

export type SceneManager = ReturnType<typeof createSceneManager>;
