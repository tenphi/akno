# V25 development diagnostics

Runtime commit: `3988ba1`. These diagnostics use exposed v15 sources and do not constitute a full release trial. Runtime: GPT-5.6 Luna; independent output review: GPT-5.6 Sol.

The selected report, sanding exclusion and undated proposal produced 2/3 useful retained sets and 14/24 useful answers. All nonnull answers were source-entailing, qualified and language compliant. The exclusion was empty: the generator changed a limitation on what an exclusion establishes into a claim that the whole contract says nothing about electrical repairs; semantic verification rejected it. The two other cases each had one unjustified answer null.

The separate built-package report/undated probe, run after rebuild and service restart, produced 2/2 useful retained sets and 15/16 useful answers. All nonnull answers were source-entailing, qualified and language compliant. One report answer was null. No source-byte change or unsafe factual promotion was found in either diagnostic.

The fresh v16 held-out corpus was not executed. Subsequent development can address these exposed failures without contaminating its unexecuted validation sources. This result improves representation of the report and original-source clock, but does not meet the full repeated 90% gate.
