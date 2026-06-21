import { peek$, type StateContext, set$ } from "@/state/state";
import type { ItemRenderMode } from "@/types.base";

const DEFAULT_VELOCITY_THRESHOLD = 5;
const DEFAULT_SETTLE_DELAY_MS = 500;

function scheduleItemRenderModeSettle(ctx: StateContext, settleDelayMs: number) {
    const state = ctx.state;
    const previousTimeout = state.timeoutItemRenderMode;
    if (previousTimeout !== undefined) {
        clearTimeout(previousTimeout);
        state.timeouts.delete(previousTimeout);
        state.timeoutItemRenderMode = undefined;
    }

    if (settleDelayMs <= 0) {
        setItemRenderMode(ctx, "normal");
    } else {
        const timeout: any = setTimeout(() => {
            state.timeouts.delete(timeout);
            state.timeoutItemRenderMode = undefined;
            setItemRenderMode(ctx, "normal");
        }, settleDelayMs);
        state.timeoutItemRenderMode = timeout;
        state.timeouts.add(timeout);
    }
}

export function setItemRenderMode(ctx: StateContext, mode: ItemRenderMode) {
    const previousMode = peek$(ctx, "itemRenderMode");
    if (previousMode !== mode) {
        set$(ctx, "itemRenderMode", mode);
        ctx.state.props.itemRenderMode?.onChange?.(mode);
    }
}

export function updateItemRenderMode(ctx: StateContext, scrollVelocity: number) {
    const state = ctx.state;
    const itemRenderMode = state.props.itemRenderMode;
    const settleDelayMs = itemRenderMode?.settleDelayMs ?? DEFAULT_SETTLE_DELAY_MS;
    const velocityThreshold = itemRenderMode?.velocityThreshold ?? DEFAULT_VELOCITY_THRESHOLD;
    const nextMode = Math.abs(scrollVelocity) > velocityThreshold ? "light" : "normal";
    const currentMode = peek$(ctx, "itemRenderMode");
    const previousMode = state.timeoutItemRenderMode !== undefined ? "normal" : currentMode;

    if (nextMode !== previousMode) {
        if (nextMode === "light") {
            setItemRenderMode(ctx, "light");
            scheduleItemRenderModeSettle(ctx, settleDelayMs);
        } else if (currentMode === "light") {
            scheduleItemRenderModeSettle(ctx, settleDelayMs);
        }
    }
}
