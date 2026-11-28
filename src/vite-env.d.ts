/// <reference types="vite/client" />

declare module '*.avif' {
  const src: string;
  export default src;
}
declare module '*.webp' {
  const src: string;
  export default src;
}
declare module '*.glb' {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  /** '1' only for a local production-activation rehearsal build (src/world/pocket/productionWorlds.ts). */
  readonly VITE_POCKET_REHEARSAL?: string;
}
