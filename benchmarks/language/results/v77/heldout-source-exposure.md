# V21 held-out source exposure and quarantine

During V77 launch-provenance work, the implementation agent mistakenly printed the beginning of `language-corpus-v21.ts` while locating its export. This exposed the first held-out report case's source items. No held-out outputs were generated or viewed, and no implementation or regression fixture derives from that source. The existing V21 held-out inputs and approvals remain unchanged and unexecuted.

V21 is no longer treated as an entirely unseen held-out split for this implementation agent. Its full repeated trial is quarantined. The already exposed V21 development and V20 development diagnostics are unchanged. A fresh independent author is preparing V22 with the same V21 development cases and an entirely new held-out split for separate input review before any full-trial authorization. The root agent will integrate and hash those inputs without displaying their contents.

This incident does not change any prior result, threshold, failure classification or diagnostic denominator. The V77 runtime and new full-trial input registry must still receive independent code review and all required gates before freeze or execution.
