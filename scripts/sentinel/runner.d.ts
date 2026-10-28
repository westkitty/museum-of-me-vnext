export declare function getBaselineSha(): string;
export declare function getChangedFiles(baselineSha: string): string[];
export declare function mapToSystems(changedFiles: string[]): string[];
export declare function determineTests(systems: string[]): string[];
export declare function reconcileIssues(previousIssues: Record<string, unknown>[], newIssues: Record<string, unknown>[], currentSha: string): Record<string, unknown>[];
