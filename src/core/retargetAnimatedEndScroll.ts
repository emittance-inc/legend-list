import { calculateOffsetForIndex } from "@/core/calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "@/core/calculateOffsetWithOffsetPosition";
import { clampScrollOffset } from "@/core/clampScrollOffset";
import { Platform } from "@/platform/Platform";
import type { StateContext } from "@/state/state";

type ActiveScrollTarget = NonNullable<StateContext["state"]["scrollingTo"]>;

const TARGET_OFFSET_EPSILON = 0.1;

// The end inset can change while a scroll to the end is running, for example when a chat
// composer shrinks after a message is sent.
export function retargetActiveAnimatedEndScroll(ctx: StateContext) {
    const { state } = ctx;
    const scrollingTo = state.scrollingTo;
    const dataLength = state.props.data.length;
    if (
        Platform.OS !== "web" &&
        scrollingTo?.animated &&
        !scrollingTo.isInitialScroll &&
        !scrollingTo.viewPositionFallback &&
        scrollingTo.index !== undefined &&
        dataLength > 0 &&
        scrollingTo.index >= dataLength - 1 &&
        (scrollingTo.viewPosition ?? 0) > 0
    ) {
        retargetAnimatedEndScroll(ctx, scrollingTo);
    }
}

// A native animated scroll keeps heading for the offset it was dispatched with. When the end it
// aims for moves, the animation is sent to the new end instead of being corrected once it stops.
export function retargetAnimatedEndScroll(ctx: StateContext, scrollingTo: ActiveScrollTarget) {
    // Same target computation as scrollToIndex, with the current sizes and insets.
    const offset = calculateOffsetForIndex(ctx, scrollingTo.index!);
    const targetOffset = clampScrollOffset(
        ctx,
        calculateOffsetWithOffsetPosition(ctx, offset, scrollingTo),
        scrollingTo,
    );
    if (
        scrollingTo.targetOffset === undefined ||
        Math.abs(targetOffset - scrollingTo.targetOffset) > TARGET_OFFSET_EPSILON
    ) {
        scrollingTo.offset = offset;
        scrollingTo.targetOffset = targetOffset;
        ctx.doScrollTo!({ animated: true, horizontal: ctx.state.props.horizontal, offset: targetOffset });
    }
}
