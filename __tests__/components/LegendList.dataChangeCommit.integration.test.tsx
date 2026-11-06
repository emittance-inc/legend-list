import { describe, expect, it } from "bun:test";
import "../setup";

import * as React from "react";
import { Text } from "react-native";

import type { LegendListRef } from "../../src/types.base";
import TestRenderer, { act } from "../helpers/testRenderer";

interface Item {
    id: string;
    label: string;
}

const ITEM_SIZE = 50;
const layoutEvent = { nativeEvent: { layout: { height: 200, width: 320, x: 0, y: 0 } } };

function createItems(prefix: string, count: number): Item[] {
    return Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}`, label: `${prefix} ${index}` }));
}

// The viewport is four rows tall, and the row that starts at its end edge is rendered too.
function visibleLabels(prefix: string) {
    return createItems(prefix, 5).map((item) => item.label);
}

function collectLabels(node: any, labels: string[] = []) {
    if (typeof node === "string") {
        labels.push(node);
    } else if (Array.isArray(node)) {
        for (const child of node) {
            collectLabels(child, labels);
        }
    } else if (node?.children) {
        collectLabels(node.children, labels);
    }
    return labels;
}

// Maps each rendered label to the offset of the container that holds it.
function collectPositions(node: any, positions: Record<string, number> = {}, top?: number) {
    if (typeof node === "string") {
        if (top !== undefined) {
            positions[node] = top;
        }
    } else if (Array.isArray(node)) {
        for (const child of node) {
            collectPositions(child, positions, top);
        }
    } else if (node?.children) {
        // Later style entries win, and the position follows the container's base style.
        const style = [node.props?.style].flat(Infinity).findLast((entry: any) => typeof entry?.top === "number");
        collectPositions(node.children, positions, style?.top ?? top);
    }
    return positions;
}

async function flushFrames(count = 8) {
    for (let i = 0; i < count; i++) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
    }
}

// Mounts the real component tree behind a stand-in scroll view and records what the host
// tree shows at every commit.
async function mountList(importSuffix: string, listProps: Record<string, unknown> = {}) {
    const { LegendList } = await import(`../../src/components/LegendList?${importSuffix}`);
    let scrollProps: any;
    const ScrollSurface = React.forwardRef(function TestScrollSurface(props: any, forwardedRef: React.Ref<any>) {
        scrollProps = props;
        React.useImperativeHandle(forwardedRef, () => ({
            getScrollableNode: () => undefined,
            measure: () => {},
            scrollTo: () => {},
        }));
        return <>{props.children}</>;
    });
    const renderScrollComponent = (props: any) => <ScrollSurface {...props} />;
    const keyExtractor = (item: Item) => item.id;
    const getFixedItemSize = () => ITEM_SIZE;
    const renderItem = ({ item }: { item: Item }) => <Text>{item.label}</Text>;

    const listRef = React.createRef<LegendListRef>();
    const commits: string[][] = [];
    const commitPositions: Array<Record<string, number>> = [];
    let renderer: ReturnType<typeof TestRenderer.create>;
    const onCommit = () => {
        if (renderer) {
            const tree = renderer.toJSON();
            commits.push(collectLabels(tree));
            commitPositions.push(collectPositions(tree));
        }
    };
    const element = (data: Item[], extraProps: Record<string, unknown> = {}) => (
        <React.Profiler id="list" onRender={onCommit}>
            <LegendList
                data={data}
                drawDistance={0}
                estimatedItemSize={ITEM_SIZE}
                getFixedItemSize={getFixedItemSize}
                keyExtractor={keyExtractor}
                maintainVisibleContentPosition={false}
                recycleItems
                ref={listRef}
                renderItem={renderItem}
                renderScrollComponent={renderScrollComponent}
                {...listProps}
                {...extraProps}
            />
        </React.Profiler>
    );

    const initialData = createItems("old", 20);
    await act(async () => {
        renderer = TestRenderer.create(element(initialData));
    });
    await flushFrames();
    await act(async () => {
        scrollProps.onLayout(layoutEvent);
    });
    await flushFrames();

    return {
        commitPositions,
        commits,
        getLabels: () => collectLabels(renderer.toJSON()),
        listRef,
        unmount: () => act(async () => renderer.unmount()),
        update: async (data: Item[], extraProps?: Record<string, unknown>) => {
            commits.length = 0;
            commitPositions.length = 0;
            await act(async () => {
                renderer.update(element(data, extraProps));
            });
        },
    };
}

describe("LegendList data change commit", () => {
    it("renders the rows of replaced data in the commit that receives the data", async () => {
        const list = await mountList("data-change-commit-replace");
        expect(list.getLabels()).toEqual(visibleLabels("old"));

        await list.update(createItems("new", 20));

        expect(list.commits[0]).toEqual(visibleLabels("new"));
        await flushFrames();
        expect(list.getLabels()).toEqual(visibleLabels("new"));

        // The first change also swaps the set of hidden keys for none, which rerenders every
        // slot. A second change has to reach the containers without that.
        await list.update(createItems("newer", 20));

        expect(list.commits[0]).toEqual(visibleLabels("newer"));

        await list.unmount();
    });

    it("renders the rows of replaced data in the same commit while a programmatic scroll is pending", async () => {
        // A search list scrolls to the top when its query changes, just before its results arrive.
        const list = await mountList("data-change-commit-scrolling");
        await act(async () => {
            void list.listRef.current?.scrollToOffset({ animated: false, offset: 0 });
        });

        await list.update(createItems("new", 20));

        expect(list.commits[0]).toEqual(visibleLabels("new"));

        await list.unmount();
    });

    it("hides removed rows until the layout effect while a scroll to an item is running", async () => {
        // The data change can remove the scroll target, and cancelling the scroll sends scroll commands.
        const list = await mountList("data-change-commit-scrolling-to-item");
        await act(async () => {
            void list.listRef.current?.scrollToIndex({ animated: true, index: 15 });
        });

        await list.update(createItems("new", 3));

        expect(list.commits[0]).toEqual([]);
        await flushFrames();
        expect(list.getLabels()).toEqual(createItems("new", 3).map((item) => item.label));

        await list.unmount();
    });

    it("renders the remaining and the added rows together when part of the data is replaced", async () => {
        const list = await mountList("data-change-commit-partial");
        const kept = createItems("old", 2);

        await list.update([kept[0], ...createItems("new", 5), kept[1]]);

        expect(list.commitPositions[0]).toEqual({
            "new 0": 50,
            "new 1": 100,
            "new 2": 150,
            "new 3": 200,
            "old 0": 0,
        });

        await list.unmount();
    });

    it("moves a row that stays in the data in the commit that receives the data", async () => {
        const list = await mountList("data-change-commit-move");
        const [first, second, third] = createItems("old", 3);

        await list.update([third, first, second]);

        expect(list.commitPositions[0]).toEqual({ "old 0": 50, "old 1": 100, "old 2": 0 });

        await list.unmount();
    });

    it("never renders a row whose item was removed together with its record", async () => {
        // A row that reads its own record rerenders in the render that removes the record,
        // like a Relay fragment of a deleted node.
        const records = new Set(createItems("old", 20).map((item) => item.id));
        const listeners = new Set<() => void>();
        const rendersWithoutRecord: string[] = [];
        function RecordRow({ item }: { item: Item }) {
            const [, rerender] = React.useReducer((count: number) => count + 1, 0);
            React.useEffect(() => {
                listeners.add(rerender);
                return () => {
                    listeners.delete(rerender);
                };
            }, []);
            if (!records.has(item.id)) {
                rendersWithoutRecord.push(item.id);
            }
            return <Text>{item.label}</Text>;
        }
        const renderItem = ({ item }: { item: Item }) => <RecordRow item={item} />;
        const replaceRecords = (items: Item[]) => {
            records.clear();
            for (const item of items) {
                records.add(item.id);
            }
            for (const listener of Array.from(listeners)) {
                listener();
            }
        };

        for (const maintainVisibleContentPosition of [false, true]) {
            const list = await mountList(`data-change-commit-records-${maintainVisibleContentPosition}`, {
                maintainVisibleContentPosition,
                renderItem,
            });
            for (const round of [1, 2]) {
                const nextItems = createItems(`new-${maintainVisibleContentPosition}-${round}`, 20);

                await act(async () => {
                    replaceRecords(nextItems);
                    await list.update(nextItems);
                });
                await flushFrames();

                expect(rendersWithoutRecord).toEqual([]);
                expect(list.getLabels()).toEqual(nextItems.slice(0, 5).map((item) => item.label));
            }

            await list.unmount();
            replaceRecords(createItems("old", 20));
        }
    });

    it("empties its containers in the commit that receives empty data", async () => {
        const list = await mountList("data-change-commit-empty");

        await list.update([]);

        expect(list.commits[0]).toEqual([]);

        await list.unmount();
    });

    it("hides removed rows until the layout effect when it maintains the scroll position for data", async () => {
        const list = await mountList("data-change-commit-mvcp", { maintainVisibleContentPosition: true });
        expect(list.getLabels()).toEqual(visibleLabels("old"));

        await list.update(createItems("new", 20));

        expect(list.commits[0]).toEqual([]);
        await flushFrames();
        expect(list.getLabels()).toEqual(visibleLabels("new"));

        await list.unmount();
    });

    it("reports viewable items after the commit instead of during the render", async () => {
        let phase = "idle";
        const phasesAtCallback: string[] = [];
        const viewableKeys: string[][] = [];
        function CommitMarker() {
            React.useLayoutEffect(() => {
                phase = "commit";
            });
            return null;
        }
        const list = await mountList("data-change-commit-viewability", {
            ListHeaderComponent: CommitMarker,
            onViewableItemsChanged: ({ viewableItems }: { viewableItems: Array<{ key: string }> }) => {
                phasesAtCallback.push(phase);
                viewableKeys.push(viewableItems.map((token) => token.key));
            },
            viewabilityConfig: { itemVisiblePercentThreshold: 50 },
        });
        await flushFrames();
        phasesAtCallback.length = 0;
        viewableKeys.length = 0;

        phase = "render";
        await list.update(createItems("new", 20));
        await flushFrames();

        expect(viewableKeys.at(-1)).toEqual(["new-0", "new-1", "new-2", "new-3"]);
        expect(phasesAtCallback).not.toContain("render");

        await list.unmount();
    });
});
