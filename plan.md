1. Use `write_file` to create `src/choreo/VisitorChoreographer.ts` with the base class, timeline scrubber state, and the top-down SVG map logic (similar to MapPanel but independent).
2. Use `replace_with_git_merge_diff` to add the playback control logic, route simulation (calculating positions based on `visitorRouteForVNext`), and conflict detection to `src/choreo/VisitorChoreographer.ts`.
3. Use `replace_with_git_merge_diff` to append the evidence report rendering (showing conflict counts, elapsed times, and distances) to `src/choreo/VisitorChoreographer.ts`.
4. Use `write_file` to add the corresponding styles in `src/choreo/choreo.css`.
5. Use `run_in_bash_session` to run `ls -la src/choreo` to verify the new choreographer files were successfully created.
6. Use `replace_with_git_merge_diff` to modify `src/main.ts` to intercept the `?choreo=1` URL parameter and conditionally load and mount the Choreographer.
7. Use `replace_with_git_merge_diff` to modify `src/app/App.ts`, and use it again to modify `src/ui/HUD.ts` to support the Choreographer toggle/update lifecycle.
8. Use `run_in_bash_session` to run `npm run typecheck` to verify the application still compiles correctly without TypeScript errors.
9. Use `run_in_bash_session` to run `npm run test`, `npm run test:workshop`, and `npm run gate` to ensure all functionality remains green.
10. Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
11. Submit the changes.
