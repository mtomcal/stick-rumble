Each iteration, pick the next unchecked item from IMPLEMENTATION_PLAN.md's progress checklist and implement it. Work through items in order — one system section per iteration (all checklist items in that section).

IMPORTANT:

check the course corrections section in IMPLEMENTATION_PLAN.md FIRST every iteration — follow any active corrections before doing anything else.
you CAN edit any file under `stick-rumble-client/` and `stick-rumble-server/` — source code, tests, and configs.
you CAN read any file under `specs/` for reference but CANNOT edit spec files.
you CANNOT edit PROMPT.md or ORCHESTRATOR.md.
update IMPLEMENTATION_PLAN.md after each iteration: check off completed items `[x]`, log any discoveries in the Worker Discovery Log section.
always run relevant tests before committing (`make test-server` for server changes, `make test-client` for client changes).
commit your work at the end of every iteration. Use git author: `git commit --author="mtomcal <mtomcal@users.noreply.github.com>"`.
output `/done` when all progress checklist items are checked off (excluding HUMAN ONLY items).
