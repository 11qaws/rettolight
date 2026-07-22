# Graph Report - workspace  (2026-07-22)

## Corpus Check
- 202 files · ~249,659 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2701 nodes · 5888 edges · 154 communities (134 shown, 20 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 70 edges (avg confidence: 0.6)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `49fa7c84`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- candidateBoundaryRevision.ts
- highlightFusion.ts
- candidateRanking.ts
- candidateAudioEventRun.ts
- candidatePassBRun.ts
- durableAnalysisPayload.ts
- candidateAudioEvent.ts
- candidateEvidenceExplanation.ts
- App.tsx
- candidateAudioEvent.worker.ts
- candidateAudioEventWorkerClient.ts
- rejectedOperation
- analysisRun.ts
- localAudioReactionAnalysis.test.ts
- analysisResultStore.ts
- candidateAudioEventWorkerProtocol.ts
- localAudioReactionAnalysisCore.ts
- localFileFingerprint.ts
- candidatePassBWorkerClient.ts
- chatImport.ts
- AnalysisResultStore
- compilerOptions
- 사람 중심 후보 검토
- candidatePassB.worker.ts
- candidatePassBWorkerProtocol.ts
- candidateAudioEventWorkerClient.test.ts
- decodeAndScore
- candidatePassB.ts
- localMediaPreflight.ts
- localVideoVisualAnalysis.ts
- candidatePassBGemini.ts
- candidatePassBPresentation.ts
- localVideoVisualAnalysisCore.ts
- AnalysisRun State Machine
- 로컬 데이터·비밀정보 보안 경계
- analysisResultStore.test.ts
- candidatePassBWorkerClient.test.ts
- highlightSelector.ts
- compilerOptions
- evaluate-local-audio-fast-pass.mjs
- aiProviderConfiguration.ts
- candidateMerge.ts
- sourceCheck.ts
- broadcastTopicalDiscovery.ts
- loadVideoMetadata
- broadcastTranscriptWorkerClient.ts
- runChatAnalysisWorker
- devDependencies
- broadcastContextProtocol.ts
- localVideoVisualAnalysis.test.ts
- contextAwareCandidateSelection.ts
- eventFence.ts
- analysisBudgetPolicy.ts
- chatAnalysisWorkerClient.ts
- aiProxy.worker.ts
- FakeVideoProbe
- broadcastTranscript.worker.ts
- broadcastTranscriptWorkerClient.test.ts
- candidateReviewFeatureAvailability.ts
- localAudioReactionAnalysis.ts
- FakeVideoProbe
- dependencies
- scripts
- broadcastContextDeepseekClient.ts
- clipRenderer.ts
- candidatePassBRuntime.ts
- candidatePassBInsightStore.ts
- ExClipper
- highlightExport.ts
- candidateVideoFrames.ts
- smoke-gemini-proxy.mjs
- cleanupResources
- LocalMediaPreflightAdapters
- package.json
- Q: Where should grounded VTuber participant identity be added without changing highlight ranking?
- LocalVideoVisualAnalysisAdapters
- Q: 세팅하려면 이제 뭐가 필요하지
- CandidatePassBWorkerFailureReason
- Q: How do durable analysis records prevent raw chat and nickname leakage through arbitrary nested fields?
- Q: 현재의 하이라이트 검출은 무슨 기준을 사용하고 있지
- Q: 스트리머 반응 중심 목표 대비 현재 하이라이트 검출 신호의 적합성, 오탐, 미탐, 다음 구조를 감사
- Q: 근데 클립이란건 스트리머의 반응을 보는거지 화려한 연출을 보는게 아니야. 이게 맞는 접근인지 알려진 다른 사례들과 함께 확인해
- Q: 0.3 오디오 반응부터 설명·저장·내보내기까지의 경로
- Q: Candidate Pass B 구조가 App, Worker, provisional evidence, finalizing 완료 fence를 어떻게 연결하는가?
- Q: Trace candidate array order consumers and design CandidateRankingProposal lifecycle
- Q: 0.3.5 후보 재정렬 제안은 canonical 후보, 정밀 근거, 검토·경계·미리보기·export를 어떻게 안전하게 분리해야 하는가?
- Q: Beginner UX audit for per-candidate event and reaction explanations including evidence lifecycle states.
- Q: 현재 v0.3.6 미커밋 diff를 초심자 UI/UX, 접근성, 모바일, 과장 표현 관점에서 다시 읽기 전용 감사해 주세요. App.tsx, styles/retto-highlight.css, README와 새 설명 모듈을 보되 수정은 하지 말고 P0/P1/P2만 파일·라인 근거로 보고하세요. 이전 지적이 실제로 해결됐는지도 확인하세요.
- Q: 현재 v0.3.6 미커밋 diff를 초심자 UI/UX, 접근성, 모바일, 과장 표현 관점에서 다시 읽기 전용 감사해 주세요. App.tsx, styles/retto-highlight.css, README와 새 설명 모듈을 보되 수정은 하지 말고 P0/P1/P2만 파일·라인 근거로 보고하세요. 이전 지적이 실제로 해결됐는지도 확인하세요.
- Q: 후보별 사건·반응 설명을 어떤 근거 경계로 구현하고 UI에 연결해야 하나?
- Q: 현재 repo에서 local Whisper CandidatePassB 흐름을 Gemini API 기반 후보 오디오 전사/사건 설명으로 교체하거나 병행하는 최소 안전 수직 슬라이스
- Q: How does App start Gemini candidate analysis and keep the response fenced from canonical editing state?
- Q: Should v0.3.6 add a Korean text generator or deterministic evidence explanation?
- FakeInput
- broadcastTranscriptQwenClient.ts
- IndexedDbAnalysisResultStore
- tsconfig.json
- highlightSelector.test.ts
- evaluate-live-caption-context.mjs
- evaluate-caption-selection.mjs
- Q: Where is the model routing policy disconnected from runtime, and which paths control provider fallback?
- broadcastSelectionProtocol.ts
- vite
- broadcastContextSamplingPlan.ts
- MAX_CANDIDATE_AUDIO_EVENT_CANDIDATES
- aiProxy.worker.test.ts
- candidatePassBEvidenceState.ts
- sampleEvaluationContract.ts
- audioReactionAnalysis.worker.ts
- candidatePassBQwenOmni.ts
- handleBroadcastTranscriptRequest
- highlightNarrative.ts
- @emnapi/runtime
- recoverableAnalysisResults.test.ts
- appendHiddenElement
- discoveredLeadRefinement.ts
- eslint
- captionCandidateEvidence.ts
- @types/react
- candidatePassBModelDownloadProgress.ts
- runCandidateAudioEventWorker
- Q: Audit candidate selection, context, music filtering, participant identity, transcript transport, and timeline architecture.
- LocalMediaPreflightError
- broadcastContextTimelinePresentation.ts
- WindowPcmBuilder
- isRecord
- CandidatePassBVideoFrame
- Q: How should ExClipper distinguish semantic chapter and lead states on the restored timeline?
- broadcastTranscriptChapters.ts
- broadcastTranscriptQwen.ts
- evaluate-caption-refinement.mjs
- broadcastContextSessionStore.ts
- localMediaPreflight.test.ts
- semanticLeadCandidate.ts
- candidatePassBInsightStore.test.ts
- candidateEvidenceExplanation.test.ts
- ExClipper `0.3.34` 적용 판단
- summarizeCandidatePassBAudioGate
- evaluate-caption-context.mjs
- smoke-broadcast-transcript.mjs
- inspect-youtube-caption-json3.mjs
- BroadcastTranscriptWorkerClientError
- QWEN_CANDIDATE_MODEL_ID
- QWEN_CANDIDATE_MODEL_REVISION
- @eslint/js
- eslint-plugin-react-hooks
- eslint-plugin-react-refresh
- @types/node
- @vitejs/plugin-react

## God Nodes (most connected - your core abstractions)
1. `App()` - 126 edges
2. `IndexedDbAnalysisResultStore` - 27 edges
3. `analyzeLocalVideoVisuals()` - 24 edges
4. `rejectedOperation()` - 24 edges
5. `InMemoryAnalysisResultStore` - 23 edges
6. `invalid()` - 23 edges
7. `compilerOptions` - 23 edges
8. `handleBroadcastTranscriptRequest()` - 21 edges
9. `AnalysisResultStore` - 21 edges
10. `runCandidatePassBWorker()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `불변 StreamSaver CSS 기준과 Retto 오버라이드` --conceptually_related_to--> `개인용 제품 production 출시 기준`  [INFERRED]
  AGENTS.md → OPERATIONS.md
- `0.3.0 문서 정합성과 미커밋 기록` --conceptually_related_to--> `개인용 제품 production 출시 기준`  [INFERRED]
  DEVELOPMENT_LOG.md → OPERATIONS.md
- `buildFastPassCandidates()` --calls--> `buildEventEpisodes()`  [EXTRACTED]
  scripts/evaluate-live-caption-context.mjs → src/analysis/contextAwareCandidateSelection.ts
- `buildFastPassCandidates()` --calls--> `selectContextAwareCandidates()`  [EXTRACTED]
  scripts/evaluate-live-caption-context.mjs → src/analysis/contextAwareCandidateSelection.ts
- `requestContext()` --calls--> `createBroadcastContextRequest()`  [EXTRACTED]
  scripts/evaluate-live-caption-context.mjs → src/analysis/broadcastContextProtocol.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **계층형 AI 하이라이트 분석 파이프라인** — product_plan_analysis_orchestrator, product_plan_fast_pass, product_plan_candidate_recall, product_plan_deep_pass, product_plan_multimodal_fusion, product_plan_boundary_refinement, product_plan_candidate_diversity [EXTRACTED 1.00]

## Communities (154 total, 20 thin omitted)

### Community 0 - "candidateBoundaryRevision.ts"
Cohesion: 0.06
Nodes (67): UnifiedHighlightCandidate, audienceReactionExplanation(), audioRange(), buildHighlightNarrative(), chatRange(), eventExplanation(), HighlightInterpretationBasis, recommendationExplanation() (+59 more)

### Community 1 - "highlightFusion.ts"
Cohesion: 0.06
Nodes (72): BroadcastContextDiscoveredLeadCategory, attachVisualContext(), AUDIO_EVENT_KINDS, AudioHighlightCandidate, AudioHighlightCandidateEvidence, AudioReactionEventKind, canonicalSignalKinds(), clamp() (+64 more)

### Community 2 - "candidateRanking.ts"
Cohesion: 0.05
Nodes (63): CandidateAudioEventEvidenceById, CandidatePassBEvidenceById, evidenceQualityRank(), mergeCandidatePassBEvidence(), fallback, provisional, buildCandidateRankingProposal(), buildDraft() (+55 more)

### Community 3 - "candidateAudioEventRun.ts"
Cohesion: 0.07
Nodes (55): accept(), assertCandidateAudioEventRunInvariant(), baseAfterWorkerEvent(), baseOf(), CANDIDATE_AUDIO_EVENT_TERMINAL_STATUSES, CandidateAudioEventCancelTerminationKind, CandidateAudioEventCandidateOutcome, CandidateAudioEventCandidateSnapshot (+47 more)

### Community 4 - "candidatePassBRun.ts"
Cohesion: 0.07
Nodes (56): accept(), assertCandidatePassBRunInvariant(), baseAfterWorkerEvent(), baseOf(), CANDIDATE_PASS_B_TERMINAL_STATUSES, candidateEventRejection(), CandidatePassBCancelTerminationKind, CandidatePassBCandidateFailureReasonCode (+48 more)

### Community 5 - "durableAnalysisPayload.ts"
Cohesion: 0.11
Nodes (50): ANALYSIS_INPUT_KEYS, asPlainRecord(), assertAudioEvidence(), assertAudioGapReason(), assertBoolean(), assertCandidate(), assertChatEvidence(), assertChatInput() (+42 more)

### Community 6 - "candidateAudioEvent.ts"
Cohesion: 0.07
Nodes (45): aggregateCandidateAudioEventScores(), aggregationQuality(), aggregationQualityTuple(), assertAndIndexWindowScores(), assertScoreVector(), assertTarget(), assertTargetSet(), baseResult() (+37 more)

### Community 7 - "candidateEvidenceExplanation.ts"
Cohesion: 0.09
Nodes (42): assertEffectiveRange(), assertEvidenceBindings(), AUDIO_EVENT_KIND_LABELS, audioEventBasisCodes(), audioEventDetections(), audioEventObservation(), audioObservation(), buildCandidateEvidenceExplanation() (+34 more)

### Community 8 - "App.tsx"
Cohesion: 0.05
Nodes (59): BROADCAST_TRANSCRIPT_ACTIVE_MODEL_REVISION, candidateAudioEventKindLabel(), CandidateEvidenceUnknown, AnalysisCoverageSummary, AnalysisGapApprovalEvidence, analysisRunLabel(), AnalysisSelectionSummary, App() (+51 more)

### Community 9 - "candidateAudioEvent.worker.ts"
Cohesion: 0.10
Nodes (36): acknowledgeAfterLoadedModelCleanup(), ANALYZE_REQUEST_KEYS, analyzeCandidate(), AnalyzeRequest, assertPinnedId2Label(), BUNDLED_ORT_WASM_URL, CancelRequest, CandidateFailure (+28 more)

### Community 10 - "candidateAudioEventWorkerClient.ts"
Cohesion: 0.13
Nodes (36): CandidateAudioEventFenceRejectionReason, CandidateAudioEventWorkerErrorCode, CandidateAudioEventWorkerFactory, fenceEvent(), FenceOutcome, hasExactKeys(), hasResponseKeys(), hasValidResultBase() (+28 more)

### Community 11 - "rejectedOperation"
Cohesion: 0.20
Nodes (7): assertIdentifier(), cloneJson(), InMemoryAnalysisResultStore, rejectedOperation(), validateAndCloneAnalysisRecord(), validateAndCloneSourceSnapshot(), cloneCandidatePassBInsightsRecord()

### Community 12 - "analysisRun.ts"
Cohesion: 0.09
Nodes (33): applyAnalysisEvent(), AnalysisControlState, AnalysisControlStateInput, AnalysisRunStatus, BUSY_RUN_STATUSES, CANCELLABLE_RUN_STATUSES, deriveAnalysisControlState(), accept() (+25 more)

### Community 13 - "localAudioReactionAnalysis.test.ts"
Cohesion: 0.10
Nodes (19): AudioAnalysisOutcome, AudioReactionWorkerRequest, analyzeLocalAudioReactions(), LocalAudioReactionWorkerLike, normalizeCancelAcknowledgementTimeout(), normalizeWorkerTimeout(), completeResult, decodingProgress (+11 more)

### Community 14 - "analysisResultStore.ts"
Cohesion: 0.13
Nodes (35): ALL_OBJECT_STORES, AnalysisPayloadByKind, AnalysisRecord, AnalysisRecordKind, AnalysisResultStoreErrorCode, analysisSchemaFamily(), AnalysisStoreName, AnalysisTerminalRecordCatalog (+27 more)

### Community 15 - "candidateAudioEventWorkerProtocol.ts"
Cohesion: 0.10
Nodes (29): CandidateAudioEventAggregation, ActiveTask, base, base, CandidateAudioEventRunResult, FenceState, NormalizedRunInput, RunCandidateAudioEventWorkerOptions (+21 more)

### Community 16 - "localAudioReactionAnalysisCore.ts"
Cohesion: 0.12
Nodes (30): adjacentWindows(), amplitudeToDb(), AudioReactionCandidate, AudioReactionCandidateEvidence, AudioReactionEventKind, buildClusters(), clamp(), clampInteger() (+22 more)

### Community 17 - "localFileFingerprint.ts"
Cohesion: 0.10
Nodes (27): bytesToHex(), ContentDigestAdapter, createContentFingerprint(), fallbackFingerprint(), lengthDelimited(), abortedError(), bytesToHex(), createLocalFileFingerprint() (+19 more)

### Community 18 - "candidatePassBWorkerClient.ts"
Cohesion: 0.12
Nodes (40): CandidatePassBEventFenceRejectionReason, CandidatePassBWorkerErrorCode, CandidatePassBWorkerFactory, fenceEvent(), FenceOutcome, hasBoundedCodePointLength(), hasExactKeys(), hasResponseKeys() (+32 more)

### Community 19 - "chatImport.ts"
Cohesion: 0.12
Nodes (30): aliasAuthor(), AliasValue, AUTHOR_ALIASES, ChatImportDiagnostic, ChatImportDiagnosticCode, ChatImportDiagnosticSeverity, ChatImportFormat, ChatImportResult (+22 more)

### Community 20 - "AnalysisResultStore"
Cohesion: 0.09
Nodes (20): AnalysisManifestRecord, AnalysisResultStore, AnalysisTerminalOutcome, AnalysisTerminalRecord, FinalAnalysisResultRecord, CandidatePassBInsightsRecord, durableCoverageDisposition(), auditRecoverableAnalysisResults() (+12 more)

### Community 21 - "compilerOptions"
Cohesion: 0.06
Nodes (30): DOM, DOM.Iterable, ES2022, src, vite/client, WebWorker, compilerOptions, allowJs (+22 more)

### Community 22 - "사람 중심 후보 검토"
Cohesion: 0.12
Nodes (30): AI 우선 하이라이트 흐름, 분석 오케스트레이터, 초심자 중심 단방향 UX, 30~60초 경계 다듬기, 중복 억제·후보 다양성, 후보 회수·탐색 슬롯, 사람 중심 후보 검토, 채팅 로그 가져오기 (+22 more)

### Community 23 - "candidatePassB.worker.ts"
Cohesion: 0.12
Nodes (33): analyzeCandidateWithRemoteAi(), AnalyzeRequest, CandidateFailure, candidateGap(), CandidatePcmBuilder, clamp(), clampInteger(), createEventId() (+25 more)

### Community 24 - "candidatePassBWorkerProtocol.ts"
Cohesion: 0.15
Nodes (20): ActiveAudioTask, createEventId(), disposeInputOnce(), handleCancel(), MutableFeatureWindow, postProgress(), postResponse(), runTask() (+12 more)

### Community 25 - "candidateAudioEventWorkerClient.test.ts"
Cohesion: 0.09
Nodes (14): CandidateAudioEventWorkerError, emit(), emitCandidateProgress(), emitModelReady(), FakeWorker, identity, StartOverrides, targets (+6 more)

### Community 26 - "decodeAndScore"
Cohesion: 0.09
Nodes (25): boundedText(), buildFastPassCandidates(), captionTextForRange(), chapters, discoverySlices, fastPass, juryPlan, overviewCostUsd (+17 more)

### Community 27 - "candidatePassB.ts"
Cohesion: 0.05
Nodes (57): assertCandidate(), assertMaxCandidates(), assertSourceDuration(), assertTarget(), buildCandidatePassBEvidence(), CandidatePassBBasisLabel, CandidatePassBCue, CandidatePassBCuePhase (+49 more)

### Community 28 - "localMediaPreflight.ts"
Cohesion: 0.12
Nodes (24): assertValidFile(), AUDIO_EXTENSIONS, CapabilityGlobal, createProbeWaitState(), DEFAULT_ADAPTERS, DocumentGlobal, durationSecondsToMilliseconds(), extensionFromName() (+16 more)

### Community 29 - "localVideoVisualAnalysis.ts"
Cohesion: 0.11
Nodes (22): AnalyzeLocalVideoVisualOptions, analyzeLocalVideoVisuals(), assertValidFile(), clampInteger(), copyFingerprint(), DEFAULT_ADAPTERS, DEFAULT_VISUAL_METADATA_TIMEOUT_MS, DEFAULT_VISUAL_SEEK_TIMEOUT_MS (+14 more)

### Community 30 - "candidatePassBGemini.ts"
Cohesion: 0.09
Nodes (41): buildCandidatePassBAudioOnlySafeResponse(), buildCandidatePassBGeminiRequestBody(), buildCandidatePassBPrompt(), buildCandidatePassBProxyRequestBody(), CANDIDATE_PASS_B_PROXY_ENDPOINT, CandidatePassBGeminiAnalysis, CandidatePassBGeminiParseOutcome, CandidatePassBGeminiRelativeSegment (+33 more)

### Community 31 - "candidatePassBPresentation.ts"
Cohesion: 0.10
Nodes (23): requestContext(), assertIdentifier(), assertRange(), assertText(), assertUniqueIdentifiers(), BROADCAST_CONTEXT_SCHEMA_VERSION, BroadcastContextCandidateCategory, BroadcastContextClipDecision (+15 more)

### Community 32 - "localVideoVisualAnalysisCore.ts"
Cohesion: 0.13
Nodes (23): buildVisualSampleTimestamps(), clamp(), clampInteger(), compareTransitions(), createCandidate(), createTransitionSignals(), LocalVideoVisualAnalysisDiagnostics, LocalVideoVisualAnalysisResult (+15 more)

### Community 33 - "AnalysisRun State Machine"
Cohesion: 0.14
Nodes (25): AnalysisJob AnalysisSpec and AnalysisRun Model, AnalysisRun State Machine, AppSession and Single Writer Lease, Atomic Analysis Checkpoint, AI Candidate and User Revision Merge Policy, Chat Import and Local Live Capture Lifecycles, Completed With Gaps Contract, Domain Event Envelope (+17 more)

### Community 34 - "로컬 데이터·비밀정보 보안 경계"
Cohesion: 0.14
Nodes (24): 초심자 중심 단방향 UI·UX, 상태·생애주기 우선 설계 계약, 계정·공유·공용 백엔드·클라우드 AI 제외, GitHub Pages 서버 없는 핵심 완주, 불변 StreamSaver CSS 기준과 Retto 오버라이드, 로컬 데이터·비밀정보 보안 경계, 1인용 로컬 우선 AI 편집 어시스턴트, SemVer·개발 로그·승인 후 커밋 (+16 more)

### Community 35 - "analysisResultStore.test.ts"
Cohesion: 0.08
Nodes (23): ANALYSIS_RESULT_OBJECT_STORES, AnalysisFailureRecord, AnalysisResultStoreError, ProvisionalAnalysisResultRecord, AUDIO_CANDIDATE, ControlledOpenRequest, ControlledRequest, ControlledTransaction (+15 more)

### Community 36 - "candidatePassBWorkerClient.test.ts"
Cohesion: 0.10
Nodes (13): CandidatePassBWorkerLike, emit(), FakeWorker, identity, targets, WorkerEventType, WorkerListener, CANDIDATE_PASS_B_DTYPE (+5 more)

### Community 37 - "highlightSelector.ts"
Cohesion: 0.18
Nodes (19): baselineValues(), BUCKET_SIZE_MS, clamp(), compareScoredBuckets(), createBucket(), createCandidate(), emptyResult(), finiteNonNegativeInteger() (+11 more)

### Community 38 - "compilerOptions"
Cohesion: 0.11
Nodes (18): ES2023, node, vite.config.ts, vitest.config.ts, compilerOptions, exactOptionalPropertyTypes, lib, module (+10 more)

### Community 39 - "evaluate-local-audio-fast-pass.mjs"
Cohesion: 0.18
Nodes (12): amplitudeToDb(), candidatePeakDistribution(), candidateSummary(), captureStdout(), clamp(), decodeFeatures(), main(), percentile() (+4 more)

### Community 40 - "aiProviderConfiguration.ts"
Cohesion: 0.08
Nodes (40): AI_MODEL_ROUTING_POLICY_VERSION, BROADCAST_TRANSCRIPT_GEMINI_MODEL_ID, BROADCAST_TRANSCRIPT_GEMINI_MODEL_REVISION, BROADCAST_TRANSCRIPT_QWEN_OMNI_MODEL_ID, BROADCAST_TRANSCRIPT_QWEN_OMNI_MODEL_REVISION, AI_PROVIDER_CONFIGURATION_VERSION, AiProviderConfigurationErrorCode, AiProviderConfigurationFailure (+32 more)

### Community 41 - "candidateMerge.ts"
Cohesion: 0.15
Nodes (15): CandidateCompareOnlyReason, CandidateField, CandidateFieldMergeOutcome, CandidateMergeContext, CandidateProposal, CandidateProposalMergeOutcome, compareOnly(), globalCompareOnlyReason() (+7 more)

### Community 42 - "sourceCheck.ts"
Cohesion: 0.17
Nodes (18): applySourceEvent(), accept(), assertNever(), baseOf(), createSourceCheck(), isSourceCheckTerminal(), reduceSourceCheck(), reject() (+10 more)

### Community 43 - "broadcastTopicalDiscovery.ts"
Cohesion: 0.18
Nodes (15): BroadcastContextCandidateInput, BroadcastContextChapterInput, boundedText(), BROADCAST_TOPICAL_DISCOVERY_VERSION, BroadcastTopicalDiscoverySlice, BroadcastTopicalLeadJuryPlan, createBroadcastTopicalDiscoverySlices(), createBroadcastTopicalLeadJuryPlan() (+7 more)

### Community 44 - "loadVideoMetadata"
Cohesion: 0.20
Nodes (8): abortedError(), attemptCleanup(), cleanupResources(), defaultYieldControl(), loadVideoMetadata(), LocalVideoVisualProbe, mediaFailure(), seekVideo()

### Community 45 - "broadcastTranscriptWorkerClient.ts"
Cohesion: 0.18
Nodes (14): BroadcastContextTranscriptionChunk, BROADCAST_TRANSCRIPT_QWEN_SCHEMA_VERSION, BroadcastTranscriptQwenResult, isBroadcastTranscriptModelId(), BroadcastTranscriptWorkerRunResult, inputIssue(), isRecord(), isResponse() (+6 more)

### Community 46 - "runChatAnalysisWorker"
Cohesion: 0.17
Nodes (11): ChatAnalysisWorkerLike, normalizeWorkerTimeout(), runChatAnalysisWorker(), emptyResult, identity, startWith(), WorkerEventType, WorkerListener (+3 more)

### Community 47 - "devDependencies"
Cohesion: 0.12
Nodes (17): @emnapi/core, globals, devDependencies, @emnapi/core, globals, tsx, @types/react-dom, typescript (+9 more)

### Community 48 - "broadcastContextProtocol.ts"
Cohesion: 0.17
Nodes (28): BROADCAST_CONTEXT_DEEPSEEK_ENDPOINT, BroadcastContextDeepseekParseOutcome, BroadcastContextDeepseekRequestBody, BroadcastContextParseOptions, BroadcastContextQwenMode, BroadcastContextQwenRequestBody, buildBroadcastContextDeepseekRequestBody(), buildBroadcastContextQwenRequestBody() (+20 more)

### Community 49 - "localVideoVisualAnalysis.test.ts"
Cohesion: 0.16
Nodes (10): captureDefaultLumaFingerprint(), LocalVideoVisualCanvas, createVisualHarness(), FakeCanvas, fingerprint(), samplesFromValues(), VideoEventType, MAX_VISUAL_SAMPLE_COUNT (+2 more)

### Community 50 - "contextAwareCandidateSelection.ts"
Cohesion: 0.15
Nodes (24): buildEventEpisodes(), calculateBlockQuotas(), CandidateSelectionEligibility, canJoinEpisode(), clamp(), compareCandidateStrength(), ContextAwareSelectionOptions, ContextAwareSelectionResult (+16 more)

### Community 51 - "eventFence.ts"
Cohesion: 0.19
Nodes (12): ChatAnalysisWorkerError, createEventFence(), CreateEventFenceInput, EventFenceOutcome, EventFenceRejectionReason, EventFenceState, FenceableEvent, fenceEvent() (+4 more)

### Community 52 - "analysisBudgetPolicy.ts"
Cohesion: 0.29
Nodes (7): ANALYSIS_BUDGET_POLICY_VERSION, AnalysisBudgetEnvelope, createAnalysisBudgetEnvelope(), CandidatePassBCostEstimate, clampInteger(), estimateCandidatePassBCost(), formatEstimatedUsd()

### Community 53 - "chatAnalysisWorkerClient.ts"
Cohesion: 0.28
Nodes (11): ChatAnalysisWorkerFactory, hasFiniteNumberFields(), isChatCandidate(), isFenceEnvelope(), isFiniteNumber(), isHighlightSelectionResult(), isNonNegativeInteger(), isRecord() (+3 more)

### Community 54 - "aiProxy.worker.ts"
Cohesion: 0.09
Nodes (29): AI_PROVIDER_ROUTING_POLICY_VERSION, AiProviderEnvironment, BroadcastContextConnection, CandidateInsightProviderId, AiProxyDependencies, AiProxyEnvironment, BodyTooLargeError, BroadcastContextProviderAttempt (+21 more)

### Community 56 - "broadcastTranscript.worker.ts"
Cohesion: 0.20
Nodes (12): ActiveTask, clamp(), decodeRange(), disposeTask(), isRecord(), isValidAnalyzeRequest(), isValidCancelRequest(), isValidIdentity() (+4 more)

### Community 57 - "broadcastTranscriptWorkerClient.test.ts"
Cohesion: 0.29
Nodes (3): FakeWorker, BroadcastTranscriptWorkerRequest, BroadcastTranscriptWorkerResponse

### Community 58 - "candidateReviewFeatureAvailability.ts"
Cohesion: 0.24
Nodes (7): CandidateReviewFeatureAvailability, CandidateReviewFeatureAvailabilityErrorCode, CandidateReviewFeatureAvailabilityInputError, deriveCandidateReviewFeatureAvailability(), MULTIPLE_CANDIDATE_FEATURES, NO_CANDIDATE_FEATURES, SINGLE_CANDIDATE_FEATURES

### Community 59 - "localAudioReactionAnalysis.ts"
Cohesion: 0.21
Nodes (18): LocalAudioReactionAnalysisStage, hasExactKeys(), isCandidate(), isCompletedResult(), isFenceEnvelope(), isFiniteNumber(), isNonNegativeInteger(), isProgress() (+10 more)

### Community 61 - "dependencies"
Cohesion: 0.22
Nodes (9): @huggingface/transformers, mediabunny, dependencies, @huggingface/transformers, mediabunny, react, react-dom, react (+1 more)

### Community 62 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, check, cloudflare:deploy, cloudflare:dev, dev, evaluate:live-context, lint (+4 more)

### Community 63 - "broadcastContextDeepseekClient.ts"
Cohesion: 0.16
Nodes (15): BROADCAST_CONTEXT_PROXY_ENDPOINT, BroadcastContextAnalysisMode, BroadcastContextDeepseekClientError, FetchImplementation, parseBroadcastContextProxyResult(), requestBroadcastContextDeepseek(), input, result (+7 more)

### Community 64 - "clipRenderer.ts"
Cohesion: 0.22
Nodes (13): buildClipFileName(), ClipOutputKind, ClipRenderError, ClipRenderFailureCode, ClipRenderProgress, ClipRenderRequest, ClipRenderResult, clipTimePart() (+5 more)

### Community 65 - "candidatePassBRuntime.ts"
Cohesion: 0.28
Nodes (6): CandidatePassBRuntimeCapabilitySnapshot, CandidatePassBRuntimeSelectionOptions, LegacyCandidatePassBDevice, NavigatorWithOptionalGpu, selectCandidatePassBRuntimeDevice(), PreferredPreflightRuntimeTier

### Community 66 - "candidatePassBInsightStore.ts"
Cohesion: 0.19
Nodes (22): CandidatePassBQwenOmniRequestBody, CANDIDATE_PASS_B_GEMINI_MODEL_ID, CANDIDATE_PASS_B_LEGACY_GEMINI_MODEL_ID, CANDIDATE_PASS_B_LEGACY_GEMINI_MODEL_REVISION, CANDIDATE_PASS_B_PREVIOUS_GEMINI_MODEL_REVISION, CANDIDATE_PASS_B_PREVIOUS_QWEN_MODEL_REVISION, CANDIDATE_PASS_B_QWEN_MODEL_ID, CANDIDATE_PASS_B_QWEN_MODEL_REVISION (+14 more)

### Community 67 - "ExClipper"
Cohesion: 0.25
Nodes (7): CHZZK 채팅, ExClipper, GitHub Pages 배포, 개발 서버에서 실행하기, 설계 문서, 저장과 계정, 지금 구현된 첫 수직 슬라이스

### Community 68 - "highlightExport.ts"
Cohesion: 0.21
Nodes (14): chronologicalDetectionOrder(), mergeCandidateAudioEventEvidence(), mergeDetectedResults(), sameBinding(), sameDetection(), sameDetectionList(), strengthRank(), buildCandidateAudioEventPresentation() (+6 more)

### Community 69 - "candidateVideoFrames.ts"
Cohesion: 0.36
Nodes (8): abortIfRequested(), CANDIDATE_VIDEO_FRAME_SAMPLE_RATIOS, CandidateVideoFrameSamplingOptions, candidateVideoFrameTimestamps(), dataUrlToBase64(), sampleCandidateVideoFrames(), waitForCurrentVideoFrame(), waitForVideoSeek()

### Community 70 - "smoke-gemini-proxy.mjs"
Cohesion: 0.22
Nodes (8): expectedInsightKeys, extraction, insight, insightKeys, offsetSeconds, result, videoFrames, wav

### Community 72 - "LocalMediaPreflightAdapters"
Cohesion: 0.25
Nodes (3): createDefaultObjectURL(), LocalMediaPreflightAdapters, revokeDefaultObjectURL()

### Community 73 - "package.json"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 74 - "Q: Where should grounded VTuber participant identity be added without changing highlight ranking?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Where should grounded VTuber participant identity be added without changing highlight ranking?, Source Nodes

### Community 76 - "Q: 세팅하려면 이제 뭐가 필요하지"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: 세팅하려면 이제 뭐가 필요하지, Source Nodes

### Community 77 - "CandidatePassBWorkerFailureReason"
Cohesion: 0.47
Nodes (4): ProxyWorkerFailure, CandidatePassBProxyHttpFailure, CandidatePassBWorkerError, CandidatePassBWorkerFailureReason

### Community 78 - "Q: How do durable analysis records prevent raw chat and nickname leakage through arbitrary nested fields?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: How do durable analysis records prevent raw chat and nickname leakage through arbitrary nested fields?, Source Nodes

### Community 79 - "Q: 현재의 하이라이트 검출은 무슨 기준을 사용하고 있지"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: 현재의 하이라이트 검출은 무슨 기준을 사용하고 있지, Source Nodes

### Community 80 - "Q: 스트리머 반응 중심 목표 대비 현재 하이라이트 검출 신호의 적합성, 오탐, 미탐, 다음 구조를 감사"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: 스트리머 반응 중심 목표 대비 현재 하이라이트 검출 신호의 적합성, 오탐, 미탐, 다음 구조를 감사, Source Nodes

### Community 81 - "Q: 근데 클립이란건 스트리머의 반응을 보는거지 화려한 연출을 보는게 아니야. 이게 맞는 접근인지 알려진 다른 사례들과 함께 확인해"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: 근데 클립이란건 스트리머의 반응을 보는거지 화려한 연출을 보는게 아니야. 이게 맞는 접근인지 알려진 다른 사례들과 함께 확인해, Source Nodes

### Community 82 - "Q: 0.3 오디오 반응부터 설명·저장·내보내기까지의 경로"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: 0.3 오디오 반응부터 설명·저장·내보내기까지의 경로, Source Nodes

### Community 83 - "Q: Candidate Pass B 구조가 App, Worker, provisional evidence, finalizing 완료 fence를 어떻게 연결하는가?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Candidate Pass B 구조가 App, Worker, provisional evidence, finalizing 완료 fence를 어떻게 연결하는가?, Source Nodes

### Community 84 - "Q: Trace candidate array order consumers and design CandidateRankingProposal lifecycle"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Trace candidate array order consumers and design CandidateRankingProposal lifecycle, Source Nodes

### Community 85 - "Q: 0.3.5 후보 재정렬 제안은 canonical 후보, 정밀 근거, 검토·경계·미리보기·export를 어떻게 안전하게 분리해야 하는가?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: 0.3.5 후보 재정렬 제안은 canonical 후보, 정밀 근거, 검토·경계·미리보기·export를 어떻게 안전하게 분리해야 하는가?, Source Nodes

### Community 86 - "Q: Beginner UX audit for per-candidate event and reaction explanations including evidence lifecycle states."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Beginner UX audit for per-candidate event and reaction explanations including evidence lifecycle states., Source Nodes

### Community 87 - "Q: 현재 v0.3.6 미커밋 diff를 초심자 UI/UX, 접근성, 모바일, 과장 표현 관점에서 다시 읽기 전용 감사해 주세요. App.tsx, styles/retto-highlight.css, README와 새 설명 모듈을 보되 수정은 하지 말고 P0/P1/P2만 파일·라인 근거로 보고하세요. 이전 지적이 실제로 해결됐는지도 확인하세요."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: 현재 v0.3.6 미커밋 diff를 초심자 UI/UX, 접근성, 모바일, 과장 표현 관점에서 다시 읽기 전용 감사해 주세요. App.tsx, styles/retto-highlight.css, README와 새 설명 모듈을 보되 수정은 하지 말고 P0/P1/P2만 파일·라인 근거로 보고하세요. 이전 지적이 실제로 해결됐는지도 확인하세요., Source Nodes

### Community 88 - "Q: 현재 v0.3.6 미커밋 diff를 초심자 UI/UX, 접근성, 모바일, 과장 표현 관점에서 다시 읽기 전용 감사해 주세요. App.tsx, styles/retto-highlight.css, README와 새 설명 모듈을 보되 수정은 하지 말고 P0/P1/P2만 파일·라인 근거로 보고하세요. 이전 지적이 실제로 해결됐는지도 확인하세요."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: 현재 v0.3.6 미커밋 diff를 초심자 UI/UX, 접근성, 모바일, 과장 표현 관점에서 다시 읽기 전용 감사해 주세요. App.tsx, styles/retto-highlight.css, README와 새 설명 모듈을 보되 수정은 하지 말고 P0/P1/P2만 파일·라인 근거로 보고하세요. 이전 지적이 실제로 해결됐는지도 확인하세요., Source Nodes

### Community 89 - "Q: 후보별 사건·반응 설명을 어떤 근거 경계로 구현하고 UI에 연결해야 하나?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: 후보별 사건·반응 설명을 어떤 근거 경계로 구현하고 UI에 연결해야 하나?, Source Nodes

### Community 90 - "Q: 현재 repo에서 local Whisper CandidatePassB 흐름을 Gemini API 기반 후보 오디오 전사/사건 설명으로 교체하거나 병행하는 최소 안전 수직 슬라이스"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: 현재 repo에서 local Whisper CandidatePassB 흐름을 Gemini API 기반 후보 오디오 전사/사건 설명으로 교체하거나 병행하는 최소 안전 수직 슬라이스, Source Nodes

### Community 91 - "Q: How does App start Gemini candidate analysis and keep the response fenced from canonical editing state?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: How does App start Gemini candidate analysis and keep the response fenced from canonical editing state?, Source Nodes

### Community 92 - "Q: Should v0.3.6 add a Korean text generator or deterministic evidence explanation?"
Cohesion: 0.50
Nodes (3): Answer, Outcome, Q: Should v0.3.6 add a Korean text generator or deterministic evidence explanation?

### Community 93 - "FakeInput"
Cohesion: 0.06
Nodes (31): ActiveTask, FakeAudioSampleSink, FakeBlobSource, FakeInput, FakeInputDisposedError, FakeUnsupportedInputFormatError, identity, mediaHarness (+23 more)

### Community 94 - "broadcastTranscriptQwenClient.ts"
Cohesion: 0.33
Nodes (7): BROADCAST_TRANSCRIPT_PROXY_ENDPOINT, BroadcastTranscriptQwenClientError, FetchImplementation, isRecord(), optionalLabel(), parseResult(), requestBroadcastTranscriptQwenChunk()

### Community 95 - "IndexedDbAnalysisResultStore"
Cohesion: 0.15
Nodes (9): IndexedDbAnalysisResultStore, keyPathFor(), normalizeStoreFailure(), requestError(), sortTerminalRecordsNewestFirst(), storeClosedError(), terminalConflictError(), terminalRecordsAreEquivalent() (+1 more)

### Community 97 - "highlightSelector.test.ts"
Cohesion: 0.23
Nodes (8): BroadcastContextCandidateAnnotation, buildBroadcastContextEligibilityById(), CandidateAiProjectionById, CandidateAiProjectionDisposition, CandidateAiQueueItem, ContextQualifiedFinalSelection, finalizeContextQualifiedCandidates(), selectCandidateDetailCandidateIds()

### Community 98 - "evaluate-live-caption-context.mjs"
Cohesion: 0.20
Nodes (7): RunChatAnalysisWorkerInput, FakeWorker, ChatAnalysisWorkerIdentity, ChatAnalysisWorkerRequest, ChatAnalysisWorkerResponse, NormalizedChatMessage, HighlightSelectionOptions

### Community 99 - "evaluate-caption-selection.mjs"
Cohesion: 0.15
Nodes (10): candidateMap, candidates, chapters, context, parentLead, ranked, refinement, result (+2 more)

### Community 100 - "Q: Where is the model routing policy disconnected from runtime, and which paths control provider fallback?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Where is the model routing policy disconnected from runtime, and which paths control provider fallback?, Source Nodes

### Community 101 - "broadcastSelectionProtocol.ts"
Cohesion: 0.22
Nodes (8): BROADCAST_SELECTION_SCHEMA_VERSION, BroadcastSelectionCandidateInput, BroadcastSelectionCandidateRelation, BroadcastSelectionChapterInput, BroadcastSelectionCoverageGap, BroadcastSelectionRelationType, BroadcastSelectionRequest, BroadcastSelectionResult

### Community 103 - "broadcastContextSamplingPlan.ts"
Cohesion: 0.14
Nodes (19): AI_BROADCAST_CONTEXT_ROUTING_REVISION, AiAnalysisPlanStep, AiAnalysisRoutingPlan, AiAnalysisStage, createAiAnalysisRoutingPlan(), EXCLIPPER_MODEL_IDS, boundedEventPeaks(), BROADCAST_CONTEXT_SAMPLING_PLAN_VERSION (+11 more)

### Community 109 - "aiProxy.worker.test.ts"
Cohesion: 0.28
Nodes (5): encodeCandidatePassBBase64(), CANDIDATE_PASS_B_SAMPLE_RATE_HZ, createCandidateBody(), createGeminiPayload(), createQwenSsePayload()

### Community 110 - "candidatePassBEvidenceState.ts"
Cohesion: 0.30
Nodes (12): balancedJsonObject(), createYouTubeCaptionChapters(), createYouTubeCaptionRefinementTranscripts(), extractKoreanYouTubeCaptionTrack(), extractKoreanYouTubeCaptionTrackFromPlayerResponse(), isRecord(), normalizedCaptionText(), parseYouTubeCaptionJson3() (+4 more)

### Community 111 - "sampleEvaluationContract.ts"
Cohesion: 0.33
Nodes (4): NamedPositiveMoment, SAMPLE_EVALUATION_CONTRACT_VERSION, SampleEvaluationContract, SampleGroundTruthMode

### Community 112 - "audioReactionAnalysis.worker.ts"
Cohesion: 0.21
Nodes (7): AudioFeatureAccumulator, clamp(), clampInteger(), decodeAndScore(), isUnsupportedAudioCodecError(), nextPowerOfTwo(), unavailableResult()

### Community 113 - "candidatePassBQwenOmni.ts"
Cohesion: 0.32
Nodes (7): AUDIO_REACTION_CANDIDATE_WINDOW_MS, AudioReactionFeatureWindow, NormalizedWindow, ScoredWindow, baseline(), setReaction(), speechWindow()

### Community 114 - "handleBroadcastTranscriptRequest"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: How does ExClipper select topic-balanced caption refinements and prevent routine gameplay from reaching canonical editor cards?, Source Nodes

### Community 115 - "highlightNarrative.ts"
Cohesion: 0.83
Nodes (3): addCollectiveSpike(), message(), quietBaseline()

### Community 117 - "recoverableAnalysisResults.test.ts"
Cohesion: 0.21
Nodes (21): buildBroadcastTranscriptGeminiRequestBody(), buildBroadcastTranscriptQwenOmniRequestBody(), candidateProviderFailureResponse(), clientRateLimitKey(), corsHeaders(), fetch(), handleBroadcastContextRequest(), handleBroadcastTranscriptRequest() (+13 more)

### Community 118 - "appendHiddenElement"
Cohesion: 0.83
Nodes (4): appendHiddenElement(), createDefaultCanvas(), createDefaultVideoProbe(), requireDocument()

### Community 119 - "discoveredLeadRefinement.ts"
Cohesion: 0.17
Nodes (15): boundedInspectionRange(), createCaptionDiscoveredLeadRefinementPlan(), createDiscoveredLeadRefinementChapters(), createDiscoveredLeadRefinementPlan(), DISCOVERED_LEAD_REFINEMENT_VERSION, DiscoveredLeadRefinementPlan, DiscoveredLeadRefinementPlanOptions, DiscoveredLeadRefinementSegment (+7 more)

### Community 121 - "captionCandidateEvidence.ts"
Cohesion: 0.21
Nodes (12): boundedJoinedText(), captionTextForRange(), chapterTextForRange(), isExplicitMusicOnlyCaption(), FetchImplementation, isRecord(), parseYouTubeCaptionProxyResult(), requestYouTubeCaptionTrack() (+4 more)

### Community 123 - "candidatePassBModelDownloadProgress.ts"
Cohesion: 0.25
Nodes (8): byteCount(), CandidatePassBModelDownloadAggregate, CandidatePassBModelDownloadTracker, DownloadFileState, isRecord(), nonEmptyBoundedString(), safeSum(), event()

### Community 124 - "runCandidateAudioEventWorker"
Cohesion: 0.19
Nodes (9): CandidateAudioEventWorkerLike, hasValidDetectionTimeline(), isPreModelSourceGapReason(), matchesTarget(), normalizeCancelAcknowledgementTimeout(), normalizeWorkerTimeout(), runCandidateAudioEventWorker(), stageRank() (+1 more)

### Community 125 - "Q: Audit candidate selection, context, music filtering, participant identity, transcript transport, and timeline architecture."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Audit candidate selection, context, music filtering, participant identity, transcript transport, and timeline architecture., Source Nodes

### Community 127 - "broadcastContextTimelinePresentation.ts"
Cohesion: 0.25
Nodes (9): BroadcastContextResult, BroadcastContextTimelineMetric, BroadcastContextTimelinePresentation, BroadcastContextTimelinePresentationInput, BroadcastContextTimelineState, BroadcastContextUiStatus, buildBroadcastContextTimelinePresentation(), completeResult (+1 more)

### Community 128 - "WindowPcmBuilder"
Cohesion: 0.25
Nodes (5): CandidateAudioEventWindow, clamp(), clampInteger(), nextPowerOfTwo(), WindowPcmBuilder

### Community 129 - "isRecord"
Cohesion: 0.44
Nodes (9): hasExactKeys(), isBoundedNonEmptyString(), isDenseArray(), isNonNegativeSafeInteger(), isRecord(), isValidAnalyzeRequest(), isValidCancelRequest(), isValidIdentity() (+1 more)

### Community 130 - "CandidatePassBVideoFrame"
Cohesion: 0.33
Nodes (6): CandidatePassBProxyRequestBody, NormalizedRunInput, CandidatePassBTarget, CandidatePassBVideoFrame, CandidatePassBCastRosterId, CandidateInsightRequest

### Community 131 - "Q: How should ExClipper distinguish semantic chapter and lead states on the restored timeline?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: How should ExClipper distinguish semantic chapter and lead states on the restored timeline?, Source Nodes

### Community 132 - "broadcastTranscriptChapters.ts"
Cohesion: 0.70
Nodes (3): createBroadcastTranscriptChapters(), mergeBroadcastTranscriptChapters(), representativeCodePoints()

### Community 133 - "broadcastTranscriptQwen.ts"
Cohesion: 0.19
Nodes (18): BROADCAST_TRANSCRIPT_MIXED_CHECKPOINT_MODEL_REVISION, BROADCAST_TRANSCRIPT_PREVIOUS_ACTIVE_MODEL_REVISION, BROADCAST_TRANSCRIPT_QWEN_MODEL_ID, BROADCAST_TRANSCRIPT_QWEN_MODEL_REVISION, BroadcastTranscriptQwenProxyRequest, buildBroadcastTranscriptQwenRequestBody(), extractBroadcastTranscriptGeminiResponse(), extractBroadcastTranscriptQwenOmniSseResponse() (+10 more)

### Community 134 - "evaluate-caption-refinement.mjs"
Cohesion: 0.18
Nodes (10): boundedText(), captions, discoveredLeads, events, lead, parent, refineWindow(), result (+2 more)

### Community 135 - "broadcastContextSessionStore.ts"
Cohesion: 0.28
Nodes (8): assertBroadcastContextSessionRecord(), boundedString(), BROADCAST_CONTEXT_SESSION_SCHEMA_VERSION, BroadcastContextSessionRecord, cloneBroadcastContextSessionRecord(), hasExactKeys(), isRecord(), record

### Community 136 - "localMediaPreflight.test.ts"
Cohesion: 0.18
Nodes (9): assertNonNegativeFinite(), BrowserCapabilitySnapshot, BrowserCapabilitySupport, formatBytes(), formatDuration(), Harness, ProbeEventType, ProbeListener (+1 more)

### Community 137 - "semanticLeadCandidate.ts"
Cohesion: 0.33
Nodes (8): RefinedDiscoveredLeadRange, boundedText(), createSemanticLeadCandidate(), isRecord(), parseSemanticLeadCandidates(), SEMANTIC_CATEGORIES, SEMANTIC_LEAD_CANDIDATE_RECORD_VERSION, serializeSemanticLeadCandidates()

### Community 138 - "candidatePassBInsightStore.test.ts"
Cohesion: 0.40
Nodes (4): isCompatibleCandidatePassBRoutingModelRevision(), CANDIDATE_PASS_B_INSIGHT_SCHEMA_VERSION, evidence, record

### Community 139 - "candidateEvidenceExplanation.test.ts"
Cohesion: 0.11
Nodes (14): CANDIDATE_EVIDENCE_EXPLANATION_VERSION, CANDIDATE_EVIDENCE_MAX_QUOTE_CODE_POINTS, CandidateEvidenceExplanationError, CandidateEvidenceExplanationInput, resolveCandidateEvidenceReplayTarget(), audioEventBase(), audioEvidence, candidate() (+6 more)

### Community 140 - "ExClipper `0.3.34` 적용 판단"
Cohesion: 0.40
Nodes (4): Context-aware highlight pipeline 재검토 및 구현 요청, ExClipper `0.3.34` 적용 판단, 별도 구조 개선으로 보류, 이번 패치에 수용

### Community 142 - "evaluate-caption-context.mjs"
Cohesion: 0.18
Nodes (7): candidates, captions, chapters, events, fastPass, result, sourceDurationMs

### Community 143 - "smoke-broadcast-transcript.mjs"
Cohesion: 0.20
Nodes (8): durationMs, endpoint, extraction, file, requestedDurationSeconds, sampleCount, startSeconds, wav

### Community 144 - "inspect-youtube-caption-json3.mjs"
Cohesion: 0.33
Nodes (5): endSeconds, matches, pattern, payload, startSeconds

## Knowledge Gaps
- **645 isolated node(s):** `name`, `private`, `version`, `type`, `node` (+640 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Work-memory lessons

**Preferred sources** — corroborated by past sessions; start here.
- `App()` (12× useful, score=11.330032345) _(code changed — re-verify)_
- `fuseHighlightCandidates()` (4× useful, score=3.748406408)
- `runCandidatePassBWorker()` (3× useful, score=2.827218773)
- `selectChatHighlights()` (3× useful, score=2.806902741)
- `selectVisualHighlightsFromSamples()` (3× useful, score=2.806902741)
- `buildCandidatePassBEvidence()` (2× useful, score=1.883074032)
- `reduceCandidatePassBRun()` (2× useful, score=1.883074032)
- `durableAnalysisPayload.ts` (2× useful, score=1.878188896)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `runChatAnalysisWorker()` connect `runChatAnalysisWorker` to `App.tsx`, `eventFence.ts`, `chatAnalysisWorkerClient.ts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `LocalAudioReactionAnalysisResult` connect `localAudioReactionAnalysis.test.ts` to `App.tsx`, `candidatePassBWorkerProtocol.ts`, `localAudioReactionAnalysis.ts`, `localAudioReactionAnalysisCore.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `App()` connect `App.tsx` to `candidateBoundaryRevision.ts`, `highlightFusion.ts`, `candidateRanking.ts`, `candidateAudioEventRun.ts`, `broadcastTranscriptChapters.ts`, `candidatePassBRun.ts`, `candidateEvidenceExplanation.ts`, `localMediaPreflight.test.ts`, `semanticLeadCandidate.ts`, `candidatePassBInsightStore.test.ts`, `candidateEvidenceExplanation.test.ts`, `analysisRun.ts`, `localAudioReactionAnalysis.test.ts`, `analysisResultStore.ts`, `localFileFingerprint.ts`, `candidatePassBWorkerClient.ts`, `chatImport.ts`, `AnalysisResultStore`, `decodeAndScore`, `candidatePassB.ts`, `localMediaPreflight.ts`, `localVideoVisualAnalysis.ts`, `candidatePassBGemini.ts`, `sourceCheck.ts`, `broadcastTopicalDiscovery.ts`, `broadcastTranscriptWorkerClient.ts`, `runChatAnalysisWorker`, `localVideoVisualAnalysis.test.ts`, `contextAwareCandidateSelection.ts`, `analysisBudgetPolicy.ts`, `candidateReviewFeatureAvailability.ts`, `broadcastContextDeepseekClient.ts`, `clipRenderer.ts`, `highlightExport.ts`, `candidateVideoFrames.ts`, `highlightSelector.test.ts`, `broadcastContextSamplingPlan.ts`, `candidatePassBEvidenceState.ts`, `discoveredLeadRefinement.ts`, `captionCandidateEvidence.ts`, `candidatePassBModelDownloadProgress.ts`, `runCandidateAudioEventWorker`, `broadcastContextTimelinePresentation.ts`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `App()` (e.g. with `event()` and `candidateEvidenceUnknownLabel()`) actually correct?**
  _`App()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _645 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `candidateBoundaryRevision.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06054054054054054 - nodes in this community are weakly interconnected._
- **Should `highlightFusion.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.059125085440874914 - nodes in this community are weakly interconnected._