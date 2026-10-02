# One migration runner drives both the CLI and the console

Every phase is implemented once in `packages/migration`; the CLI and the console's
buttons are thin drivers over it, and the console only renders the runner's progress
events. We rejected console-only (UI logic diverges from what a scripted migration
does) and CLI-only (the console couldn't trigger anything), because the demo's value
is that what you watch is exactly what runs.
