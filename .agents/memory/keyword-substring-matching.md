---
name: Keyword-based intent classifiers need word-boundary matching
description: Why naive substring keyword matching in rule-based NLP/intent routers causes false positives, and the fix.
---

Rule-based intent/keyword classifiers that check `keyword in text` (plain substring containment) will match a short keyword even when it's embedded inside a longer, unrelated word — e.g. the keyword "mual" (nausea) matches inside "assalamualaikum" (an Islamic greeting), causing a greeting to be misclassified as a health complaint.

**Why:** Substring containment has no concept of word boundaries. Any keyword that is a short, common letter sequence is at risk of accidentally appearing inside unrelated words, especially in languages/scripts where words concatenate meaningfully (Indonesian greetings, compound words, etc.).

**How to apply:** When building or auditing keyword-based classifiers (intent routers, safety/risk keyword scanners, content filters), use word-boundary-aware matching instead of plain substring checks — e.g. regex with `(?<!\w)keyword(?!\w)` or `\bkeyword\b` applied to a normalized (lowercased, punctuation-stripped) string. This preserves multi-word phrase matching while preventing accidental partial-word collisions. Also consider adding explicit categories (e.g. "greeting"/"smalltalk") so common conversational inputs don't fall through to domain-specific keyword lists at all.
