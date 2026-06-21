import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import { updateAdaptiveRender } from "@/core/adaptiveRender";
import { peek$ } from "@/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

type TimeoutRecord = {
    callback: () => void;
    cleared?: boolean;
    delay: number;
};

describe("updateAdaptiveRender", () => {
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

    it("switches to light mode immediately when velocity exceeds the default enter velocity", () => {
        const changes: string[] = [];
        const ctx = createMockContext(
            { adaptiveRender: "normal" },
            {
                props: {
                    adaptiveRender: {
                        onChange: (mode) => changes.push(mode),
                    },
                },
            },
        );

        updateAdaptiveRender(ctx, 4.1);

        expect(peek$(ctx, "adaptiveRender")).toBe("light");
        expect(changes).toEqual(["light"]);
    });

    it("waits for the default exit delay before returning to normal mode", () => {
        const changes: string[] = [];
        const ctx = createMockContext(
            { adaptiveRender: "normal" },
            {
                props: {
                    adaptiveRender: {
                        onChange: (mode) => changes.push(mode),
                    },
                },
            },
        );

        updateAdaptiveRender(ctx, 5);
        updateAdaptiveRender(ctx, 0.5);

        expect(peek$(ctx, "adaptiveRender")).toBe("light");
        expect(timers).toHaveLength(1);
        expect(timers[0].delay).toBe(1000);

        runTimer(timers[0]);

        expect(peek$(ctx, "adaptiveRender")).toBe("normal");
        expect(changes).toEqual(["light", "normal"]);
    });

    it("cancels a pending exit timeout when velocity crosses the exit velocity again", () => {
        const ctx = createMockContext({ adaptiveRender: "normal" });

        updateAdaptiveRender(ctx, 5);
        updateAdaptiveRender(ctx, 0);

        const settleTimer = timers[0];
        updateAdaptiveRender(ctx, 2);
        runTimer(settleTimer);

        expect(settleTimer.cleared).toBe(true);
        expect(peek$(ctx, "adaptiveRender")).toBe("light");
    });

    it("does not extend settling while velocity remains below the threshold", () => {
        const ctx = createMockContext({ adaptiveRender: "normal" });

        updateAdaptiveRender(ctx, 5);
        updateAdaptiveRender(ctx, 0.5);
        updateAdaptiveRender(ctx, 0.25);

        expect(timers).toHaveLength(1);
        expect(timers[0].delay).toBe(1000);

        runTimer(timers[0]);

        expect(peek$(ctx, "adaptiveRender")).toBe("normal");
    });

    it("uses custom enter velocity, exit velocity, and exit delay values", () => {
        const ctx = createMockContext(
            { adaptiveRender: "normal" },
            {
                props: {
                    adaptiveRender: {
                        enterVelocity: 3,
                        exitDelay: 25,
                        exitVelocity: 1,
                    },
                },
            },
        );

        updateAdaptiveRender(ctx, 2);
        expect(peek$(ctx, "adaptiveRender")).toBe("normal");

        updateAdaptiveRender(ctx, 4);
        expect(peek$(ctx, "adaptiveRender")).toBe("light");

        updateAdaptiveRender(ctx, 2);
        expect(peek$(ctx, "adaptiveRender")).toBe("light");

        updateAdaptiveRender(ctx, 0);

        expect(peek$(ctx, "adaptiveRender")).toBe("light");
        expect(timers).toHaveLength(2);
        expect(timers[0].cleared).toBe(true);
        expect(timers[1].delay).toBe(25);
    });
});
