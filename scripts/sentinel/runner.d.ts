export interface Issue { id: string; check?: string; status?: string; firstSeen?: string; lastSeen?: string; history?: Record<string, unknown>[]; [key: string]: unknown }
export interface Check { cmd: string; status: string; [key: string]: unknown }
export interface Comparison { status: string; files?: string[] | null; sha?: string | null; reason?: string; baselineSha?: string; currentSha?: string; workingTreeClean?: boolean; checks?: Check[] }
export declare const CHECKS: string[];
export declare function outputDirectory(cwd?: string): string;
export declare function writeOutput(name: string, data: string, cwd?: string): string;
export declare function getBaselineSha(revision?: string, cwd?: string): Comparison;
export declare function getChangedFiles(revision?: string, cwd?: string): Comparison;
export declare function mapToSystems(files: string[]): string[];
export declare function determineTests(systems: string[]): string[];
export declare function reconcileIssues(previous: Issue[], findings: Issue[], currentSha?: string, context?: Comparison): Issue[];
export declare function run(options?: { baseline?: string; execute?: boolean; cwd?: string }): Record<string, unknown>;
