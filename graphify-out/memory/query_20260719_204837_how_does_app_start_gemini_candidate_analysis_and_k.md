---
type: "query"
date: "2026-07-19T20:48:37.750130+00:00"
question: "How does App start Gemini candidate analysis and keep the response fenced from canonical editing state?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["App()", "runCandidatePassBWorker()", "buildCandidatePassBGeminiRequestBody()", "extractCandidatePassBGeminiResponse()"]
---

# Q: How does App start Gemini candidate analysis and keep the response fenced from canonical editing state?

## Answer

Expanded from original query via graph vocabulary: app, candidate, pass, gemini, worker, client, request, response, insight, protocol, run, audio, key. The extracted graph shows App() calls runCandidatePassBWorker(); the client and Worker import the Gemini request/parser module, and responses return through the client to App. The implementation keeps API-key consent at the request boundary, validates the structured response, and lets App update only session-scoped candidate evidence after the current run fence accepts it; canonical score, boundary, ranking, review, persistence, and export remain separate.

## Outcome

- Signal: useful

## Source Nodes

- App()
- runCandidatePassBWorker()
- buildCandidatePassBGeminiRequestBody()
- extractCandidatePassBGeminiResponse()