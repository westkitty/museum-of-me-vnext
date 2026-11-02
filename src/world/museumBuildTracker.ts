let globalMuseumBuildCount = 0;

export function recordMuseumBuild(): void {
  globalMuseumBuildCount++;
}

export function getMuseumBuildCount(): number {
  return globalMuseumBuildCount;
}

export function resetMuseumBuildCount(): void {
  globalMuseumBuildCount = 0;
}
