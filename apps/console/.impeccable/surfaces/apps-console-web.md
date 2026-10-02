---
version: 1
slug: "apps-console-web"
primary_target: "apps/console/web"
related_targets: []
---

# Surface brief: migration console

Scope: the operator's view of the migration (apps/console/web). Mode: Operate.
Audience: the builder driving a migration, often presenting on a screen share.
Job: step through phases, watch traffic, trigger fault injection / rollback / reset, see cutover land.
Key moment: cutover; traffic visibly moves from on-prem to the AWS side.
Must never: show anything that looks scripted or decorative instead of live system data.

## Direction contract

THESIS: The migration is a revision to a technical drawing of the system. The console refuses the category's grid of glowing metric cards; it is one drawing sheet whose live schematic, revision block and phase schedule are all read from the running system.

OWN-WORLD: Cyanotype ground (deep Prussian blue), pale cyan-white line work at two weights, one signal colour (safety orange) reserved for faults, freeze and the point of no return; on-prem and AWS each carry a quiet ink (warm grey, pale cyan). Engineering-lettering sans for labels, monospace only for measured values (counts, checksums, rps, record values). Light mode is the same sheet printed: white paper, blue-black ink.

STORY: The viewer sees where traffic goes now, which phase we are in, and what the next action will do; they watch the route redraw at cutover and the revision block record it, and they trust it because every figure ticks live.

FIRST VIEWPORT: Top bar: product name, serving environment, theme toggle. Main area left (about two thirds): the live schematic (front door, record, on-prem store + db, ALB, ECS store + RDS) with the active route drawn heavy and animated by request flow; under it the traffic chart (requests per second by environment, rejected writes in signal orange). Right column: phase schedule as a vertical list with status per phase, the primary action button (the next phase, named), rollback and fault-injection controls, then the revision block (event log) anchored bottom-right like a drawing's title block.

FORM: Drafting sheet (engineering drawing: title block, revision table, line weights, revision cloud). Ordered list position 5 of 7; seed key e1995698. Signature move: at cutover the schematic reroutes and a revision cloud rings the changed path while Rev B is entered in the revision block.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
