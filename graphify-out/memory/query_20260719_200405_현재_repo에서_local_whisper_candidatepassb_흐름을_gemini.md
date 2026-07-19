---
type: "query"
date: "2026-07-19T20:04:05.905389+00:00"
question: "현재 repo에서 local Whisper CandidatePassB 흐름을 Gemini API 기반 후보 오디오 전사/사건 설명으로 교체하거나 병행하는 최소 안전 수직 슬라이스"
contributor: "graphify"
outcome: "useful"
source_nodes: ["App()", "runCandidatePassBWorker()", "reduceCandidatePassBRun()", "buildCandidatePassBEvidence()", "buildCandidateEvidenceExplanation()"]
---

# Q: 현재 repo에서 local Whisper CandidatePassB 흐름을 Gemini API 기반 후보 오디오 전사/사건 설명으로 교체하거나 병행하는 최소 안전 수직 슬라이스

## Answer

Expanded from graph vocab: candidate, pass, worker, evidence, state, event, fence, store, export, presentation, audio, transcript. Preserve App operation epoch plus CandidatePassB run reducer and client fence; replace worker inference with candidate-only PCM-to-WAV Gemini calls; validate bounded structured output; keep key memory-only and Pass B evidence non-durable; add explicit remote-provider and disclosure UI; route semantic interpretation into candidate explanation without score/rank authority.

## Outcome

- Signal: useful

## Source Nodes

- App()
- runCandidatePassBWorker()
- reduceCandidatePassBRun()
- buildCandidatePassBEvidence()
- buildCandidateEvidenceExplanation()