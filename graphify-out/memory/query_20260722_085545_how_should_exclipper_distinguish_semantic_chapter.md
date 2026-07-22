---
type: "query"
date: "2026-07-22T08:55:45.066135+00:00"
question: "How should ExClipper distinguish semantic chapter and lead states on the restored timeline?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["App()", "BroadcastContextResult", "BroadcastContextSessionRecord"]
---

# Q: How should ExClipper distinguish semantic chapter and lead states on the restored timeline?

## Answer

Expanded from original query via vocab: semantic chapter chapters coverage timeline legacy supported context session status projection empty. App() owns broadcast context execution state, while BroadcastContextResult records feature support and evidence coverage and BroadcastContextSessionRecord preserves the paid payload. Restore only the matching run/input signature, fence stale asynchronous reads, preserve explicit legacy support flags, and project not-analyzed, restoring, failed, unsupported, partial, and completed-empty as separate UI states. Only supported completed evidence may display a numeric zero; missing evidence uses an em dash and coverage gaps remain visibly unknown.

## Outcome

- Signal: useful

## Source Nodes

- App()
- BroadcastContextResult
- BroadcastContextSessionRecord