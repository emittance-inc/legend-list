import { describe, expect, it } from "bun:test";
import { clampScrollOffset } from "../../src/core/clampScrollOffset";
import { setContentInsetOverride, setHeaderSize, updateContentMetrics } from "../../src/core/updateContentMetrics";
import { getContentSize } from "../../src/state/getContentSize";
import { createMockContext } from "../__mocks__/createMockContext";

describe("updateContentMetrics", () => {
    it("uses leading padding to absorb end inset for short vertical alignItemsAtEnd content", () => {
        const ctx = createMockContext(
            {
                totalSize: 84,
            },
            {
                contentInsetOverride: { bottom: 301 },
                props: {
                    alignItemsAtEnd: true,
                    alignItemsAtEndPaddingEnabled: true,
                    data: [1],
                },
                scrollLength: 664,
                totalSize: 84,
            },
        );

        updateContentMetrics(ctx);

        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(279);
        expect(getContentSize(ctx)).toBe(664);
        expect(clampScrollOffset(ctx, 999)).toBe(0);
    });

    it("creates scroll range only for the end inset that exceeds available leading space", () => {
        const ctx = createMockContext(
            {
                totalSize: 500,
            },
            {
                contentInsetOverride: { bottom: 301 },
                props: {
                    alignItemsAtEnd: true,
                    alignItemsAtEndPaddingEnabled: true,
                    data: [1],
                },
                scrollLength: 664,
                totalSize: 500,
            },
        );

        updateContentMetrics(ctx);

        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(0);
        expect(getContentSize(ctx)).toBe(801);
        expect(clampScrollOffset(ctx, 999)).toBe(137);
    });

    it("does not add leading padding when alignItemsAtEnd padding is disabled", () => {
        const ctx = createMockContext(
            {
                totalSize: 84,
            },
            {
                props: {
                    alignItemsAtEnd: true,
                    alignItemsAtEndPaddingEnabled: false,
                    data: [1],
                },
                scrollLength: 664,
                totalSize: 84,
            },
        );

        updateContentMetrics(ctx);

        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(0);
    });

    it("updates content metrics when header size changes through the domain setter", () => {
        const ctx = createMockContext(
            {
                headerSize: 20,
                totalSize: 84,
            },
            {
                contentInsetOverride: { bottom: 301 },
                props: {
                    alignItemsAtEnd: true,
                    alignItemsAtEndPaddingEnabled: true,
                    data: [1],
                },
                scrollLength: 664,
                totalSize: 84,
            },
        );

        updateContentMetrics(ctx);
        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(259);

        setHeaderSize(ctx, 0);

        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(279);
    });

    it("updates content metrics when reported content inset changes", () => {
        const ctx = createMockContext(
            {
                totalSize: 84,
            },
            {
                props: {
                    alignItemsAtEnd: true,
                    alignItemsAtEndPaddingEnabled: true,
                    data: [1],
                },
                scrollLength: 664,
                totalSize: 84,
            },
        );

        updateContentMetrics(ctx);
        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(580);

        expect(setContentInsetOverride(ctx, { bottom: 301 })).toBe(true);
        expect(ctx.values.get("alignItemsAtEndPadding")).toBe(279);
        expect(setContentInsetOverride(ctx, { bottom: 301 })).toBe(false);
    });
});
