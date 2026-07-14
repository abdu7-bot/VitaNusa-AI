---
name: VitaNusa AI conversation scope decision
description: Product-scope decision behind the general_chat intent and per-session conversation memory in the VitaNusa AI backend.
---

The user chose "hybrid_open" scope: VitaNusa AI may chat naturally about
general (non-health) topics and remember conversation context within a
session, but the rule-based Policy Engine and all existing safety boundaries
(no diagnosis, no personal drug doses, no cure guarantees, no manipulative
product recommendations, no definitive halal/haram fatwas; emergencies always
route to a professional) must stay fully intact for every message regardless
of how casual the conversation feels. The user also explicitly deferred real
LLM activation ("not_yet") — mock mode is the accepted default LLM backend
for now, so "answer general topics naturally" is currently implemented as an
honest, warm, rule-based reply that admits the general-knowledge limitation,
not real generative Q&A.

**Why:** without this decision it would be ambiguous whether "make it feel
like ChatGPT" meant loosening the safety guardrails. It explicitly does not —
general-topic handling is additive (a new `general_chat` intent + a
short-lived, in-process, per-session memory keyed by a client-supplied
`sessionId`), and every message — including ones in an ongoing "general"
session — still gets a fresh `detect_intent` → `classify_risk` →
`PolicyEngine.evaluate_question` pass. History is only ever handed to the
optional LLM step as phrasing context; it is never read by the safety
pipeline itself.

**How to apply:** when extending chat behavior further (e.g. turning on a
real LLM later, or adding richer general-knowledge answers via the existing
web-search router), keep the safety pipeline as the mandatory first pass on
every turn, and keep conversation memory as ephemeral/in-process (not
durable) unless the user explicitly asks for persistent chat history.
