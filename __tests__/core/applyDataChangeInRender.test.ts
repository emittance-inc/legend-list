import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import { applyDataChangeInRender, canApplyDataChangeInRender } from "../../src/core/applyDataChangeInRender";
import * as calculateItemsInViewModule from "../../src/core/calculateItemsInView";
import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types.internal";
import { createMockContext } from "../__mocks__/createMockContext";

describe("applyDataChangeInRender", () => {
    let ctx: StateContext;
    let state: InternalState;

    beforeEach(() => {
        ctx = createMockContext(
            { numContainers: 6, readyToRender: true },
            {
                didContainersLayout: true,
                initialScroll: undefined,
                isFirst: false,
                props: {
                    maintainScrollAtEnd: undefined,
                    maintainVisibleContentPosition: { data: false, size: true },
                },
                scrollLength: 400,
            },
        );
        state = ctx.state;
    });

    describe("canApplyDataChangeInRender", () => {
        it("accepts a laid out list that does not move the scroll position for data", () => {
            expect(canApplyDataChangeInRender(ctx)).toBe(true);
        });

        it("accepts a list during a programmatic scroll to an offset, which a data change leaves alone", () => {
            state.scrollingTo = { animated: false, offset: 0 } as any;

            expect(canApplyDataChangeInRender(ctx)).toBe(true);
        });

        const rejections: Array<[string, () => Partial<InternalState> | void]> = [
            ["on the first render", () => ({ isFirst: true })],
            ["when the columns changed", () => ({ didColumnsChange: true })],
            [
                "when it maintains the visible content position for data",
                () => {
                    state.props.maintainVisibleContentPosition = { data: true, size: true };
                },
            ],
            [
                "when it maintains the scroll at the end",
                () => {
                    state.props.maintainScrollAtEnd = { animated: false, on: { dataChange: true } } as any;
                },
            ],
            [
                "with anchored end space",
                () => {
                    state.props.anchoredEndSpace = { anchorIndex: 0 } as any;
                },
            ],
            ["before its containers were laid out", () => ({ didContainersLayout: false })],
            [
                "before it is ready to render",
                () => {
                    ctx.values.set("readyToRender", false);
                },
            ],
            [
                "without containers",
                () => {
                    ctx.values.set("numContainers", 0);
                },
            ],
            ["without a viewport size", () => ({ scrollLength: 0 })],
            ["with an explicit visible content anchor", () => ({ visibleContentAnchor: { key: "item-1", offset: 0 } })],
            ["during a scroll to an index", () => ({ scrollingTo: { animated: true, index: 3, offset: 300 } as any })],
            [
                "during a scroll to a key",
                () => ({ scrollingTo: { animated: true, key: "item-3", offset: 300 } as any }),
            ],
            ["during a scroll to the end", () => ({ scrollingTo: { isScrollToEnd: true, offset: 0 } as any })],
            ["with an initial scroll target", () => ({ initialScroll: { index: 3 } as any })],
            [
                "during an initial scroll session",
                () => ({ initialScrollSession: { kind: "offset", previousDataLength: 0 } }),
            ],
        ];

        for (const [name, arrange] of rejections) {
            it(`rejects a list ${name}`, () => {
                Object.assign(state, arrange());

                expect(canApplyDataChangeInRender(ctx)).toBe(false);
            });
        }
    });

    describe("applyDataChangeInRender", () => {
        let calculateItemsInViewSpy: ReturnType<typeof spyOn>;

        afterEach(() => {
            calculateItemsInViewSpy.mockRestore();
        });

        it("reassigns containers with notifications held back and records the applied change", () => {
            let wasActive: boolean | undefined;
            calculateItemsInViewSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(
                () => {
                    wasActive = ctx.renderUpdate.isActive;
                },
            );
            state.dataChangeEpoch = 4;

            applyDataChangeInRender(ctx);

            expect(calculateItemsInViewSpy).toHaveBeenCalledWith(ctx, { dataChanged: true, doMVCP: true });
            expect(wasActive).toBe(true);
            expect(ctx.renderUpdate.isActive).toBe(false);
            expect(ctx.renderUpdate.epoch).toBe(1);
            expect(state.appliedDataChangeEpoch).toBe(4);
        });

        it("notifies again after a pass that threw", () => {
            calculateItemsInViewSpy = spyOn(calculateItemsInViewModule, "calculateItemsInView").mockImplementation(
                () => {
                    throw new Error("failed");
                },
            );

            expect(() => applyDataChangeInRender(ctx)).toThrow("failed");
            expect(ctx.renderUpdate.isActive).toBe(false);
            expect(state.appliedDataChangeEpoch).toBeUndefined();
        });
    });
});
