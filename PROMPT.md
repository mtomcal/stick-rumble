Read IMPLEMENTATION_PLAN.md and pick the next unchecked finding from the fix checklist. Read the spec file, read the source code it references, then edit the spec to match reality. One finding per iteration, then stop.

IMPORTANT:

check the course corrections section FIRST every iteration — follow any active corrections before doing anything else.
only edit spec files in specs/ — do NOT edit any source code.
do NOT edit PROMPT.md, ORCHESTRATOR.md, or loop.sh.
update IMPLEMENTATION_PLAN.md progress checklist when a finding is fixed.
if you discover additional drift while fixing a finding, add it to the Discoveries section in IMPLEMENTATION_PLAN.md.
do exactly ONE checklist item per iteration, then stop.
commit your work at the end of every iteration.
use commit message format: "docs: Fix {spec-name} — {brief description of what was corrected}"
After committing, push to the remote with "git push -u origin ralph/spec-fixes" every iteration.
output `/done` when all findings are fixed.
