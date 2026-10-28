import { describe, expect, it } from 'vitest';
import { mapToSystems, determineTests, reconcileIssues } from '../scripts/sentinel/runner.js';

describe('Drift Sentinel 2.0 Proofs', () => {
    it('unchanged-baseline case: empty changes yield no systems and no tests', () => {
        const changes: string[] = [];
        const systems = mapToSystems(changes);
        expect(systems).toHaveLength(0);

        const tests = determineTests(systems);
        expect(tests).toHaveLength(0);
    });

    it('false-positive rejection: pure documentation changes bypass expensive checks', () => {
        const changes = ['docs/README.md', 'docs/ARCHITECTURE.md'];
        const systems = mapToSystems(changes);
        expect(systems).toEqual(['docs']);

        const tests = determineTests(systems);
        expect(tests).toHaveLength(0);
    });

    it('controlled change-detection fixture: specific file maps to relevant tests', () => {
        const changes = ['src/world/Museum.ts'];
        const systems = mapToSystems(changes);
        expect(systems).toContain('museum-systems');

        const tests = determineTests(systems);
        expect(tests).toContain('npm run typecheck');
        expect(tests).toContain('npm run test');
        expect(tests).not.toContain('npm run validate:mapping');
    });

    it('controlled change-detection fixture: collection change triggers specific mapping tests', () => {
        const changes = ['data/exhibit-mapping.current.json'];
        const systems = mapToSystems(changes);
        expect(systems).toContain('collection');

        const tests = determineTests(systems);
        expect(tests).toContain('npm run validate:mapping');
        expect(tests).toContain('npm run validate:content');
        expect(tests).not.toContain('npm run test');
    });

    it('confirmed-regression case: issue lifecycle tracking (new -> confirmed -> resolved)', () => {
        const previous = [
            { id: '123', status: 'new', title: 'Old failure', firstSeen: 'abc', lastSeen: 'abc' }
        ];

        // 1. Existing issue remains -> transitions to confirmed
        const currentSha1 = 'def';
        const newFailures1 = [
            { id: '123', status: 'new', title: 'Old failure', firstSeen: currentSha1, lastSeen: currentSha1 }
        ];
        const state1 = reconcileIssues(previous, newFailures1, currentSha1);
        expect(state1[0]).toMatchObject({ id: '123', status: 'confirmed', firstSeen: 'abc', lastSeen: currentSha1 });

        // 2. Issue disappears -> transitions to resolved
        const currentSha2 = 'ghi';
        const newFailures2: Record<string, unknown>[] = [];
        const state2 = reconcileIssues(state1, newFailures2, currentSha2);
        expect(state2[0]).toMatchObject({ id: '123', status: 'resolved' });

        // 3. New issue appears -> recorded as new
        const newFailures3 = [
            { id: '456', status: 'new', title: 'New failure', firstSeen: currentSha2, lastSeen: currentSha2 }
        ];
        const state3 = reconcileIssues(state2, newFailures3, currentSha2);
        expect(state3).toHaveLength(2);
        const added = state3.find((i: Record<string, unknown>) => i.id === '456');
        expect(added).toMatchObject({ id: '456', status: 'new', firstSeen: currentSha2 });
    });
});
