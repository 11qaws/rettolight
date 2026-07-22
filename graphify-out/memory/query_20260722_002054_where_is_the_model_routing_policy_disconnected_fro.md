---
type: "architecture"
date: "2026-07-22T00:20:54.934764+00:00"
question: "Where is the model routing policy disconnected from runtime, and which paths control provider fallback?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["src/analysis/aiModelRoutingPolicy.ts", "src/cloudflare/aiProviderConfiguration.ts", "src/cloudflare/aiProxy.worker.ts", "src/analysis/candidatePassB.worker.ts", "src/analysis/candidateVideoFrames.ts", "src/analysis/broadcastContextDeepseek.ts", "src/App.tsx", "src/storage/candidatePassBInsightStore.ts"]
---

# Q: Where is the model routing policy disconnected from runtime, and which paths control provider fallback?

## Answer

The role policy was previously only a planning and test catalog. Runtime routing now flows through aiProviderConfiguration into aiProxy.worker, browser response metadata, Candidate Pass B validation, App recovery, and per-candidate storage. Candidate perception has one bounded Qwen/Gemini switch, compressed context has one Qwen 3.7/3.6 switch, and long transcript chunks never auto-switch to avoid duplicate billing. The Qwen compact overview also previously omitted semantic chapters; policy 1.3 now carries grounded topic chapters from proxy parsing into the App timeline. Frame sampling failure is guarded at both client and Worker boundaries so an audio-only result cannot preserve invented screen context.

## Outcome

- Signal: useful

## Source Nodes

- src/analysis/aiModelRoutingPolicy.ts
- src/cloudflare/aiProviderConfiguration.ts
- src/cloudflare/aiProxy.worker.ts
- src/analysis/candidatePassB.worker.ts
- src/analysis/candidateVideoFrames.ts
- src/analysis/broadcastContextDeepseek.ts
- src/App.tsx
- src/storage/candidatePassBInsightStore.ts