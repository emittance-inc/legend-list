import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import { updateItemRenderMode } from "@/core/itemRenderMode";
import { peek$ } from "@/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

type TimeoutRecord = {
    callback: () => void;
    cleared?: boolean;
    delay: number;
};

describe("updateItemRenderMode", () => {
    const originalClearTimeout = globalThis.clearTimeout;
    const originalSetTimeout = globalThis.setTimeout;
    let timers: TimeoutRecord[];

    beforeEach(() => {
        timers = [];
        globalThis.setTimeout = ((callback: () => void, delay: number) => {
            const timer = { callback, delay };
            timers.push(timer);
            return timer as unknown as ReturnType<typeof setTimeout>;
        }) as typeof setTimeout;
        globalThis.clearTimeout = ((timer: TimeoutRecord) => {
            timer.cleared = true;
        }) as unknown as typeof clearTimeout;
    });

    afterEach(() => {
        globalThis.clearTimeout = originalClearTimeout;
        globalThis.setTimeout = originalSetTimeout;
    });

    function runTimer(timer: TimeoutRecord) {
        if (!timer.cleared) {
            timer.callback();
        }
    }

    it("switches to light mode immediately when velocity exceeds the default threshold", () => {
        const changes: string[] = [];
        const ctx = createMockContext(
            { itemRenderMode: "normal" },
            {
                props: {
                    itemRenderMode: {
                        onChange: (mode) => changes.push(mode),
                    },
                },
            },
        );

        updateItemRenderMode(ctx, 1.1);

        expect(peek$(ctx, "itemRenderMode")).toBe("light");
        expect(changes).toEqual(["light"]);
    });

    it("waits for the default settle delay before returning to normal mode", () => {
        const changes: string[] = [];
        const ctx = createMockContext(
            { itemRenderMode: "normal" },
            {
                props: {
                    itemRenderMode: {
                        onChange: (mode) => changes.push(mode),
                    },
                },
            },
        );

        updateItemRenderMode(ctx, 2);
        updateItemRenderMode(ctx, 0.5);

        expect(peek$(ctx, "itemRenderMode")).toBe("light");
        expect(timers).toHaveLength(2);
        expect(timers[0].cleared).toBe(true);
        expect(timers[1].delay).toBe(150);

        runTimer(timers[1]);

        expect(peek$(ctx, "itemRenderMode")).toBe("normal");
        expect(changes).toEqual(["light", "normal"]);
    });

    it("cancels a pending settle timeout when velocity crosses the threshold again", () => {
        const ctx = createMockContext({ itemRenderMode: "normal" });

        updateItemRenderMode(ctx, 2);
        updateItemRenderMode(ctx, 0);

        const settleTimer = timers[0];
        updateItemRenderMode(ctx, 2);
        runTimer(settleTimer);

        expect(settleTimer.cleared).toBe(true);
        expect(peek$(ctx, "itemRenderMode")).toBe("light");
    });

    it("uses custom threshold and settle delay values", () => {
        const ctx = createMockContext(
            { itemRenderMode: "normal" },
            {
                props: {
                    itemRenderMode: {
                        settleDelayMs: 25,
                        velocityThreshold: 3,
                    },
                },
            },
        );

        updateItemRenderMode(ctx, 2);
        expect(peek$(ctx, "itemRenderMode")).toBe("normal");

        updateItemRenderMode(ctx, 4);
        updateItemRenderMode(ctx, 0);

        expect(peek$(ctx, "itemRenderMode")).toBe("light");
        expect(timers).toHaveLength(2);
        expect(timers[0].cleared).toBe(true);
        expect(timers[1].delay).toBe(25);
    });
});
