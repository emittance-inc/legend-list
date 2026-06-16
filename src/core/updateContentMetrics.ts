import { getContentInsetEnd } from "@/state/getContentInsetEnd";
import { peek$, type StateContext, set$ } from "@/state/state";
import type { Insets } from "@/types.base";

function getRawContentLength(ctx: StateContext) {
    const { state, values } = ctx;
    return (
        (values.get("headerSize") || 0) +
        (values.get("footerSize") || 0) +
        (state.pendingTotalSize ?? state.totalSize ?? values.get("totalSize") ?? 0) +
        (state.props.stylePaddingTop || 0) +
        (state.props.stylePaddingBottom || 0)
    );
}

function getAlignItemsAtEndPadding(ctx: StateContext) {
    const { state } = ctx;
    const shouldPad =
        !!state.props.alignItemsAtEndPaddingEnabled &&
        !state.props.horizontal &&
        state.props.data.length > 0 &&
        state.scrollLength > 0;

    return shouldPad ? Math.max(0, state.scrollLength - getRawContentLength(ctx) - getContentInsetEnd(ctx)) : 0;
}

export function updateContentMetrics(ctx: StateContext) {
    const previousPadding = peek$(ctx, "alignItemsAtEndPadding") || 0;
    const nextPadding = getAlignItemsAtEndPadding(ctx);
    if (previousPadding !== nextPadding) {
        set$(ctx, "alignItemsAtEndPadding", nextPadding);
    }
}

function setContentLengthSignal(ctx: StateContext, signalName: "footerSize" | "headerSize", size: number) {
    if (peek$(ctx, signalName) !== size) {
        set$(ctx, signalName, size);
        updateContentMetrics(ctx);
    }
}

export function setHeaderSize(ctx: StateContext, size: number) {
    setContentLengthSignal(ctx, "headerSize", size);
}

export function setFooterSize(ctx: StateContext, size: number) {
    setContentLengthSignal(ctx, "footerSize", size);
}

function areInsetsEqual(left: Partial<Insets> | null | undefined, right: Partial<Insets> | null | undefined) {
    return (
        (left?.top ?? 0) === (right?.top ?? 0) &&
        (left?.bottom ?? 0) === (right?.bottom ?? 0) &&
        (left?.left ?? 0) === (right?.left ?? 0) &&
        (left?.right ?? 0) === (right?.right ?? 0)
    );
}

export function setContentInsetOverride(ctx: StateContext, inset: Partial<Insets> | null | undefined) {
    const { state } = ctx;
    const previousInset = state.contentInsetOverride;
    const nextInset = inset ?? undefined;
    const didChange = !areInsetsEqual(previousInset, nextInset);
    state.contentInsetOverride = nextInset;

    if (didChange) {
        updateContentMetrics(ctx);
    }

    return didChange;
}
