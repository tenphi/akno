# V70 round-one fix response

The selected-property dependency now appears in two strict provider-visible entry branches. The first permits all operation branches with an all-null `tested_property:not_selected`; the second permits only selected/omitted operations with present/omitted/answer-added property shapes. It no longer relies on a parser-only dependency refinement. Existing exact evidence coverage, nonempty selected contribution, anchor ownership and all negative enforcement remain mandatory.

Chat Completions and Responses controls now echo each property branch and inspect the actual transported entry alternatives, required fields, nulls and caps. The negative dependency remains a local regression too. Inherited controls are migrated to the same shape. No provider or semantic probe has been run on V70 yet.
