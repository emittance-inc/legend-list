---
id: issue-445-sectionlist-sticky-headers-data-change
source_type: github_issue
source: gh
repo: LegendApp/legend-list
issue_number: 445
issue_url: https://github.com/LegendApp/legend-list/issues/445
issue_title: SectionList updating data, sticky headers position issue
triage_status: ready
issue_type: bug
area: section-list
severity: high
urgency: high
effort: m
confidence: high
repro_quality: strong
priority_score: 20
priority_reason: Repo fix completed locally with focused regression coverage; remaining issue work is release/reporter verification rather than more implementation.
next_action: done
approval: approved
implementation_status: completed
base_ref: main@523a3806
agent_doc_version: 1
updated_at: 2026-07-09T13:11:05Z
---

# Issue

- Source: GitHub issue #445 fetched with `gh issue view` because this checkout has no cached `.github-cache/open/issues` directory.
- URL: https://github.com/LegendApp/legend-list/issues/445
- Title: SectionList updating data, sticky headers position issue
- Repo: LegendApp/legend-list
- Base: main@523a3806

# Triage

- Status: done
- Severity: high
- Confidence: high
- Type: bug
- Area: section-list
- Urgency: high
- Effort: m
- Repro: strong
- Priority: 20
- Next: done

Summary: `SectionList` sticky headers can detach from their section after section data is conditionally added or removed. The thread includes videos, multiple affected users, a reported failure on `3.1.1` after the `3.1.0` fix, and a July 8 comment saying this blocks adoption without a key-remount workaround.

Decision: Treat this as actionable, but make the first implementation step a focused reproduction of the still-broken variant. Current source has a prior `#445` fix and a passing core sticky-data-change test, so the likely missing coverage is the SectionList-level rerender/data-shape path rather than the already-covered low-level sticky callback path.

# Evidence

- Issue-reported: reporter says latest `3.0.0-beta.56` broke sticky section headers when section items are conditionally added or removed; follow-up comments confirm the problem on `3.1.1` and ask for a workaround other than changing the list `key`.
- [CHANGELOG.md](/Users/jay/Documents/code/legendapp/legend-list/CHANGELOG.md:35) records a `3.1.0` fix for `SectionList` sticky headers after section data changes at line 42, but the issue thread has later confirmations that the visible behavior still fails.
- [src/section-list/flattenSections.ts](/Users/jay/Documents/code/legendapp/legend-list/src/section-list/flattenSections.ts:95) flattens sections and recomputes `stickyHeaderIndices`; conditional item count changes can shift later header indices.
- [src/section-list/SectionList.tsx](/Users/jay/Documents/code/legendapp/legend-list/src/section-list/SectionList.tsx:179) memoizes the flattened data from `sections` and `extraData`, then passes `data`, `keyExtractor`, and `stickyHeaderIndices` into `LegendList` at line 310.
- [src/core/calculateItemsInView.ts](/Users/jay/Documents/code/legendapp/legend-list/src/core/calculateItemsInView.ts:407) resolves active sticky state from current `positions`, resets layout caches on data changes at line 509, and recomputes sticky state after positions update at line 568.
- Verification run: `bun test __tests__/section-list/SectionList.test.tsx __tests__/core/calculateItemsInView.test.ts --test-name-pattern "sticky|SectionList|data change shifts sticky"` passed 13 tests, including the existing core regression named `uses recomputed positions when a data change shifts sticky header indices`.

# Plan

1. Add or extend a focused regression that reproduces the reporter shape at the `SectionList` boundary: render a section list with sticky headers, toggle or remove items in an earlier section, and assert the active sticky header/container position tracks the recomputed flattened header indices without remounting the whole list.
2. If the SectionList-level test does not reproduce, create an example or fixture variant based on the issue videos and the `zamplyy/legend-list` fork shape, covering dynamic section item visibility, shifted later headers, and existing sticky container reuse.
3. Inspect the first reproduced failure at the lowest boundary it implicates: SectionList flatten/key stability, `LegendList` structural data-change detection, sticky container recycling, `activeStickyIndex`, or `getStickyPushLimit`.
4. Fix only the reproduced repo-owned cause. Do not replace the behavior with a key-remount workaround, because that would hide the bug while dropping list state and scroll continuity.
5. Validate with:
   - `bun test __tests__/section-list/SectionList.test.tsx`
   - `bun test __tests__/core/calculateItemsInView.test.ts --test-name-pattern "sticky|data change"`
   - `bun run tsc:src`
   - `bun run lint:fix` scoped appropriately if code changes are made

# Run Log

- Started: 2026-07-09T11:43:30Z
- Start state: branch `main`, commit `523a3806`
- Initial working tree: only the untracked `issues/` task-doc directory was present.
- Inspected:
  - `src/section-list/SectionList.tsx`
  - `src/section-list/flattenSections.ts`
  - `src/core/calculateItemsInView.ts`
  - `src/core/syncMountedContainer.ts`
  - `src/components/Container.tsx`
  - `src/components/PositionView.native.tsx`
  - `src/components/PositionView.tsx`
  - `src/integrations/reanimated.tsx`
  - `src/state/ContextContainer.ts`
  - `src/hooks/useDOMOrder.ts`
  - `src/utils/reordering.ts`
  - `__tests__/section-list/SectionList.test.tsx`
  - `__tests__/components/PositionView.native.test.tsx`
  - `__tests__/components/PositionView.web.test.tsx`
  - `__tests__/state/ContextContainer.test.tsx`
  - `__tests__/utils/reordering.test.ts`
- Reproduced the uncovered boundary with component-level regressions: a sticky header keeps the same container/prop index while its current flattened SectionList index changes from 3 to 2.
- First implementation subscribed `Container` to `containerItemInfo`, which fixed the stale index but would also rerender row containers on index-only moves such as prepends. Replaced it with a narrower `containerItemIndex` signal read by sticky positioning wrappers, recycling context, and web DOM reordering.
- Removed `containerItemInfo`; recycling hooks now share a private helper that subscribes to the primitive key/index/data signals they need.
- Removed rendered web `data-index` attributes; DOM reordering now receives a map from element to current container item index.
- Removed the stale `index` prop from built-in and internal position components; current index now comes from `containerItemIndex{id}`.
- Changed:
  - `src/state/state.tsx`
  - `src/state/ContextContainer.ts`
  - `src/core/calculateItemsInView.ts`
  - `src/core/syncMountedContainer.ts`
  - `src/components/PositionView.native.tsx`
  - `src/components/PositionView.tsx`
  - `src/hooks/useDOMOrder.ts`
  - `src/integrations/reanimated.tsx`
  - `src/utils/reordering.ts`
  - `__tests__/components/PositionView.native.test.tsx`
  - `__tests__/components/PositionView.web.test.tsx`
  - `__tests__/state/ContextContainer.test.tsx`
  - `__tests__/utils/reordering.test.ts`
- Validation:
  - `bun test __tests__/state/ContextContainer.test.tsx`: passed, 31 tests.
  - `bun test __tests__/components/PositionView.native.test.tsx --test-name-pattern "sticky|recalculated"`: passed, 3 tests.
  - `bun test __tests__/components/PositionView.web.test.tsx`: passed, 6 tests.
  - `bun test __tests__/utils/reordering.test.ts`: passed, 1 test.
  - `bun test __tests__/components/Container.clearCaches.test.tsx`: passed, 3 tests.
  - `bun test __tests__/core/syncMountedContainer.test.ts`: passed, 3 tests.
  - `bun test __tests__/section-list/SectionList.test.tsx`: passed, 6 tests.
  - `bun test __tests__/core/calculateItemsInView.test.ts --test-name-pattern "sticky|data change"`: passed, 7 tests.
  - `bun test __tests__/integrations/reanimated.itemLayoutAnimation.test.tsx --test-name-pattern "sticky|PositionComponent|positionComponent"`: passed, 3 tests.
  - `bun run tsc:src`: passed.
  - `git diff --check`: passed.
  - `bunx biome check --write --unsafe src/state/state.tsx src/state/ContextContainer.ts src/core/calculateItemsInView.ts src/core/syncMountedContainer.ts src/components/Container.tsx src/components/PositionView.native.tsx src/components/PositionView.tsx src/hooks/useDOMOrder.ts src/integrations/reanimated.tsx src/utils/reordering.ts __tests__/components/PositionView.native.test.tsx __tests__/components/PositionView.web.test.tsx __tests__/state/ContextContainer.test.tsx __tests__/utils/reordering.test.ts`: passed, formatted 1 file.

# Diagnosis

- Problem: sticky section headers could remain visually detached after SectionList data changes when the header item kept the same key while moving to a new flattened index.
- Cause: sticky position components used the `index` prop captured when `Container` rendered `getRenderedItem(itemKey)`. `Container` intentionally does not rerender for index-only moves when key/data/extraData are unchanged, so same-key sticky headers could keep a stale prop index even after `activeStickyIndex`, `indexByKey`, and positions were recomputed.
- Solution: track the current flattened item index in a dedicated `containerItemIndex{id}` signal, update it from allocation and mounted-container sync, and have sticky positioning, recycling context, and web DOM reordering read that signal. Row content remains memoized on key/data/extraData, while sticky math gets the current index needed for push limits, active sticky comparison, and zIndex.

# Changes

## Track current container item index

Added `containerItemIndex{id}` as a narrow signal for the current flattened index assigned to a mounted container.

File: `src/state/state.tsx:56`

```diff
+    | `containerItemIndex${number}`
```

File: `src/core/syncMountedContainer.ts:59`

```diff
+    const prevIndex = peek$(ctx, `containerItemIndex${containerIndex}`);
+    if (prevIndex !== itemIndex) {
+        set$(ctx, `containerItemIndex${containerIndex}`, itemIndex);
+    }
```

## Remove aggregate container item info

Removed `containerItemInfo{id}` from the listener map and core writes. Recycling hooks now share a private primitive-signal helper instead.

File: `src/state/ContextContainer.ts:42`

```diff
+    const [itemKey, itemIndex, item] = useArr$([
+        `containerItemKey${containerId}`,
+        `containerItemIndex${containerId}`,
+        `containerItemData${containerId}`,
+    ]);
```

## Subscribe sticky position wrappers to the current index

Native, web, and Reanimated sticky wrappers now use `containerItemIndex{id}` for sticky positioning decisions instead of the stale render-time `index` prop.

File: `src/components/PositionView.native.tsx:97`

```diff
+        `containerItemIndex${id}`,
+    ]);
     const pushLimit = React.useMemo(
-        () => getStickyPushLimit(ctx.state, index, itemKey),
+        () => getStickyPushLimit(ctx.state, itemIndex, itemKey),
```

## Remove web data-index ordering metadata

Web DOM reordering now receives a `Map<HTMLElement, number>` built from `ctx.viewRefs` and `containerItemIndex{id}` instead of reading `data-index` attributes from rendered DOM nodes.

## Remove position component index prop

`Container` no longer passes `index` to built-in or internal position components. Reanimated internal position component props were updated to rely on `containerItemIndex{id}` like the default components.

## Add sticky moved-index regressions

Added native and web component tests that give the sticky wrapper current `containerItemIndex=2`, then assert sticky push/activation/zIndex use index 2.

File: `__tests__/components/PositionView.native.test.tsx:164`

```diff
+    it("uses the current container index signal when a sticky item moves", () => {
+        ...
+        expect(flattenedStyle?.zIndex).toBe(1002);
+        expect(flattenedStyle?.transform).toEqual([{ translateY: expectedInterpolation }]);
+    });
```

# Result

Completed. The fix keeps sticky positioning and web DOM reordering aligned with the current flattened SectionList index when data changes move a same-key header, without making `Container` rerender on index-only moves. It also removes the now-redundant aggregate `containerItemInfo` signal, rendered web `data-index` metadata, and the stale position-component `index` prop. No `issues/priority-index.md` file exists in this checkout, so no priority index row was updated.

# Self Review

- Confidence: 92% | Good: the new regressions hit the stale sticky-index boundary directly on native and web, and the task's focused SectionList/core sticky validations pass. | Caveat: the reporter's exact app/video was not run interactively, so release verification should still ask them to retest.
- Scope: stayed within the approved SectionList/sticky data-change plan and changed only the narrow mounted-container index signal, sticky wrapper consumers, recycling context derivation, and web DOM reordering metadata.
- Risk: sticky wrappers and recycling-context consumers now rerender when their container's current flattened index changes. Web DOM reordering reads the current index map when sorting rather than rendering per-row index metadata. Row `Container` content does not subscribe to index, so index-only prepends should not broadly rerender item content.
- Tests: recycling context, focused sticky component tests, mounted-container sync, DOM reordering, container cache tests, SectionList, sticky core, Reanimated bridge, `tsc:src`, diff check, and scoped Biome check all passed.
- Follow-up: publish/release notes should reference the sticky SectionList data-change fix and ask issue reporters to verify against the released version.

# GitHub Follow-up

I found and fixed a same-key header movement path that can leave sticky positioning using the old flattened index after SectionList data changes. The local regressions move a sticky section header from index 3 to index 2 without remounting the list and now verify sticky positioning uses the current container index.

Once this is in a release, please try it without the `key` remount workaround and let us know if your app still has a remaining sticky-header case.
