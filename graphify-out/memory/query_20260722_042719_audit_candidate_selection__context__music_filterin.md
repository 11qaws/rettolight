---
type: "query"
date: "2026-07-22T04:27:19.751599+00:00"
question: "Audit candidate selection, context, music filtering, participant identity, transcript transport, and timeline architecture."
contributor: "graphify"
outcome: "useful"
source_nodes: ["createBroadcastContextTranscriptionChunks", "buildCandidatePassBPrompt", "parseCandidateRequest", "CandidatePassBParticipantEvidenceBasis", "App"]
---

# Q: Audit candidate selection, context, music filtering, participant identity, transcript transport, and timeline architecture.

## Answer

Expanded query vocabulary: candidate, selection, reservoir, episode, density, context, semantic, chapter, music, audio, identity, timeline. The critical disconnect was a 210-second transcript transport assumption paired with a 64-chunk Worker cap even though fragmented long-form sampling can require 240 requests; production probes support 90 seconds. Candidate output already allowed provided-cast-reference, but no closed roster existed in the request or prompt. Implemented 90-second resumable source-range checkpoints and a server-known closed VTuber roster while preserving the canonical candidate ledger.

## Outcome

- Signal: useful

## Source Nodes

- createBroadcastContextTranscriptionChunks
- buildCandidatePassBPrompt
- parseCandidateRequest
- CandidatePassBParticipantEvidenceBasis
- App