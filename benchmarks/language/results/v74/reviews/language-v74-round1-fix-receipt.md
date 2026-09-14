# V74 round-one fixes

The independent Sol review at language-v74-round1-review.md requested two changes. Both are implemented before round two and before any freeze/provider/corpus run.

- Language input preflight now checks audit/checkInput for null before dereferencing either. Over-24,000 prose, 65 retained references, serialized occurrence growth, exhausted remaining time, exact 24,000 serialized input and a one-unit excess have independent controls. Rejections return language_check_failed, record the typed invalid response and issue no checker request.
- The cleaner preserves both known report and clock holds at the same original position before choosing ordinary full repair. Mixed failures remain outside both text-only maps. The integration control inspects both validation issues and demonstrates that fixing only the clock leaves the report held on re-clean with no semantic call.

Focused verification: tmp/v74-round1-fix-focused-corrected.log, 74 tests in two files passed; typecheck tmp/v74-round1-fix-typecheck.log passed. Earlier failed test logs are preserved. Full final gates and the second independent review follow; no provider or corpus output is claimed.
