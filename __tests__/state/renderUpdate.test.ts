import { describe, expect, it } from "bun:test";
import "../setup";

import { flushRenderUpdate, listen$, listenPosition$, notifyPosition$, peek$, set$ } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("render update", () => {
    it("holds back the listeners of signals written during a render until it is flushed", () => {
        const ctx = createMockContext();
        const values: number[] = [];
        listen$(ctx, "totalSize", (value) => values.push(value));

        ctx.renderUpdate.isActive = true;
        set$(ctx, "totalSize", 100);
        set$(ctx, "totalSize", 200);
        ctx.renderUpdate.isActive = false;

        expect(peek$(ctx, "totalSize")).toBe(200);
        expect(values).toEqual([]);

        flushRenderUpdate(ctx);

        expect(values).toEqual([200]);

        flushRenderUpdate(ctx);

        expect(values).toEqual([200]);
    });

    it("notifies listeners at once outside a render", () => {
        const ctx = createMockContext();
        const values: number[] = [];
        listen$(ctx, "totalSize", (value) => values.push(value));

        set$(ctx, "totalSize", 100);

        expect(values).toEqual([100]);
        expect(ctx.renderUpdate.signals.size).toBe(0);
    });

    it("bumps the version of each container whose signals a render wrote", () => {
        const ctx = createMockContext();

        ctx.renderUpdate.isActive = true;
        set$(ctx, "containerItemKey2", "item-7");
        set$(ctx, "containerPosition12", 300);
        set$(ctx, "containerLayoutEpoch", 1);
        set$(ctx, "numContainers", 13);
        ctx.renderUpdate.isActive = false;

        const { containerVersions } = ctx.renderUpdate;
        expect(containerVersions[2]).toBe(1);
        expect(containerVersions[12]).toBe(1);
        expect(Object.keys(containerVersions)).toEqual(["2", "12"]);
    });

    it("leaves a container version alone when a render writes the value it already has", () => {
        const ctx = createMockContext();
        set$(ctx, "containerPosition3", 150);

        ctx.renderUpdate.isActive = true;
        set$(ctx, "containerPosition3", 150);
        ctx.renderUpdate.isActive = false;

        expect(ctx.renderUpdate.containerVersions[3]).toBeUndefined();
    });

    it("holds back position listeners and callbacks, and runs each once", () => {
        const ctx = createMockContext();
        const events: string[] = [];
        listenPosition$(ctx, "item-1", (value) => events.push(`position:${value}`));

        ctx.renderUpdate.isActive = true;
        notifyPosition$(ctx, "item-1", 50);
        notifyPosition$(ctx, "item-1", 80);
        ctx.renderUpdate.callbacks.push(() => events.push("callback"));
        ctx.renderUpdate.isActive = false;

        expect(events).toEqual([]);

        flushRenderUpdate(ctx);
        flushRenderUpdate(ctx);

        expect(events).toEqual(["position:80", "callback"]);
    });
});
