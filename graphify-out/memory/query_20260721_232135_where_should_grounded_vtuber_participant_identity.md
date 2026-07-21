---
type: "query"
date: "2026-07-21T23:21:35.341016+00:00"
question: "Where should grounded VTuber participant identity be added without changing highlight ranking?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["CandidatePassBInsight", "parseCandidatePassBGeminiAnalysis", "isInsight", "assertCandidatePassBInsightsRecord", "App"]
---

# Q: Where should grounded VTuber participant identity be added without changing highlight ranking?

## Answer

Add optional evidence-bound identifiedParticipants to CandidatePassBInsight, validate it in candidatePassBGemini and candidatePassBWorkerClient, persist it in candidatePassBInsightStore schema 1.2.0, and render it in App. It must remain display-only and never alter selection or clip bounds.

## Outcome

- Signal: useful

## Source Nodes

- CandidatePassBInsight
- parseCandidatePassBGeminiAnalysis
- isInsight
- assertCandidatePassBInsightsRecord
- App