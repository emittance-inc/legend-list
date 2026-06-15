import * as React from "react";
import { Text } from "react-native";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { updateItemSize } from "../../src/core/updateItemSize";
import { type StateContext, StateProvider, set$, useStateContext } from "../../src/state/state";
import { createImperativeHandle } from "../../src/utils/createImperativeHandle";
import { createMockState } from "../__mocks__/createMockState";
import TestRenderer, { act } from "../helpers/testRenderer";
import { registerBaseModuleMocks } from "../setup";

type TestItem = { id: string; label: string };

let measuredHeight = 80;

function registerPositionViewMeasureMock() {
    mock.module("@/components/PositionView", () => {
        const PositionView = ({ children, refView }: { children: React.ReactNode; refView: React.RefObject<any> }) => {
            refView.current = {
                measure: (callback: (x: number, y: number, width: number, height: number) => void) => {
                    callback(0, 0, 320, measuredHeight);
                },
            };

            return <>{children}</>;
        };

        return {
            PositionView,
            PositionViewSticky: PositionView,
        };
    });
}

async function flushAsync() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

beforeEach(() => {
    mock.restore();
    registerBaseModuleMocks();
    registerPositionViewMeasureMock();
    measuredHeight = 80;
});

describe("Container clearCaches measurement", () => {
    it("remeasures mounted containers from the layout effect after clearCaches", async () => {
        const data: TestItem[] = [{ id: "a", label: "Alpha" }];
        const sizesAtRecalculate: Array<number | undefined> = [];
        let ctxReady: StateContext | undefined;
        let handleReady: ReturnType<typeof createImperativeHandle> | undefined;
        const { Container } = await import("../../src/components/Container?clear-caches-sync-measure");

        function Harness() {
            const ctx = useStateContext();
            const didInitialize = React.useRef(false);

            if (!didInitialize.current) {
                ctx.state = createMockState({
                    averageSizes: { "": { avg: 80, num: 1 } },
                    didContainersLayout: true,
                    endBuffered: 0,
                    idCache: ["a"],
                    indexByKey: new Map([["a", 0]]),
                    positions: [0],
                    props: {
                        data,
                        estimatedItemSize: 100,
                        keyExtractor: (item: TestItem) => item.id,
                    },
                    sizes: new Map([["a", 80]]),
                    sizesKnown: new Map([["a", 80]]),
                    startBuffered: 0,
                    totalSize: 80,
                    triggerCalculateItemsInView: () => {
                        sizesAtRecalculate.push(ctx.state.sizesKnown.get("a"));
                    },
                });
                set$(ctx, "containerColumn0", 1);
                set$(ctx, "containerSpan0", 1);
                set$(ctx, "containerItemData0", data[0]);
                set$(ctx, "containerItemKey0", "a");
                set$(ctx, "containerPosition0", 0);
                set$(ctx, "numColumns", 1);
                set$(ctx, "totalSize", 80);
                didInitialize.current = true;
            }

            React.useLayoutEffect(() => {
                ctxReady = ctx;
                handleReady = createImperativeHandle(ctx);
            }, [ctx]);

            return (
                <Container
                    getRenderedItem={() => ({
                        index: 0,
                        item: data[0],
                        renderedItem: <Text>{data[0].label}</Text>,
                    })}
                    horizontal={false}
                    id={0}
                    itemKey="a"
                    recycleItems={false}
                    updateItemSize={(itemKey, size) => updateItemSize(ctx, itemKey, size)}
                />
            );
        }

        let renderer: TestRenderer.ReactTestRenderer;
        await act(async () => {
            renderer = TestRenderer.create(
                <StateProvider>
                    <Harness />
                </StateProvider>,
            );
        });
        await flushAsync();

        expect(ctxReady?.state.sizesKnown.get("a")).toBe(80);

        sizesAtRecalculate.length = 0;
        measuredHeight = 140;

        await act(async () => {
            handleReady?.clearCaches();
        });

        expect(sizesAtRecalculate).toEqual([undefined]);
        expect(ctxReady?.state.sizesKnown.get("a")).toBe(140);

        await act(async () => {
            renderer!.unmount();
        });
    });

    it("removes the mounted container layout trigger when the container unmounts", async () => {
        const data: TestItem[] = [{ id: "a", label: "Alpha" }];
        let ctxReady: StateContext | undefined;
        const { Container } = await import("../../src/components/Container?clear-caches-trigger-cleanup");

        function Harness() {
            const ctx = useStateContext();
            const didInitialize = React.useRef(false);

            if (!didInitialize.current) {
                ctx.state = createMockState({
                    didContainersLayout: true,
                    endBuffered: 0,
                    idCache: ["a"],
                    indexByKey: new Map([["a", 0]]),
                    positions: [0],
                    props: {
                        data,
                        keyExtractor: (item: TestItem) => item.id,
                    },
                    sizes: new Map([["a", 80]]),
                    sizesKnown: new Map([["a", 80]]),
                    startBuffered: 0,
                    totalSize: 80,
                });
                set$(ctx, "containerColumn0", 1);
                set$(ctx, "containerSpan0", 1);
                set$(ctx, "containerItemData0", data[0]);
                set$(ctx, "containerItemKey0", "a");
                set$(ctx, "containerPosition0", 0);
                set$(ctx, "numColumns", 1);
                set$(ctx, "totalSize", 80);
                didInitialize.current = true;
            }

            React.useLayoutEffect(() => {
                ctxReady = ctx;
            }, [ctx]);

            return (
                <Container
                    getRenderedItem={() => ({
                        index: 0,
                        item: data[0],
                        renderedItem: <Text>{data[0].label}</Text>,
                    })}
                    horizontal={false}
                    id={0}
                    itemKey="a"
                    recycleItems={false}
                    updateItemSize={(itemKey, size) => updateItemSize(ctx, itemKey, size)}
                />
            );
        }

        let renderer: TestRenderer.ReactTestRenderer;
        await act(async () => {
            renderer = TestRenderer.create(
                <StateProvider>
                    <Harness />
                </StateProvider>,
            );
        });

        expect(ctxReady?.containerLayoutTriggers.size).toBe(1);

        await act(async () => {
            renderer!.unmount();
        });

        expect(ctxReady?.containerLayoutTriggers.size).toBe(0);
    });
});
