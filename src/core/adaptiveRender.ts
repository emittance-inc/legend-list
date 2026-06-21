import { peek$, type StateContext, set$ } from "@/state/state";
import type { AdaptiveRender } from "@/types.base";

const DEFAULT_ENTER_VELOCITY = 4;
const DEFAULT_EXIT_VELOCITY = 1;
const DEFAULT_EXIT_DELAY = 1000;

function scheduleAdaptiveRenderExit(ctx: StateContext, exitDelay: number) {
    const state = ctx.state;
    const previousTimeout = state.timeoutAdaptiveRender;
    if (previousTimeout !== undefined) {
        clearTimeout(previousTimeout);
        state.timeouts.delete(previousTimeout);
        state.timeoutAdaptiveRender = undefined;
    }

    if (exitDelay <= 0) {
        setAdaptiveRender(ctx, "normal");
    } else {
        const timeout: any = setTimeout(() => {
            state.timeouts.delete(timeout);
            state.timeoutAdaptiveRender = undefined;
            setAdaptiveRender(ctx, "normal");
        }, exitDelay);
        state.timeoutAdaptiveRender = timeout;
        state.timeouts.add(timeout);
    }
}

export function setAdaptiveRender(ctx: StateContext, mode: AdaptiveRender) {
    const previousMode = peek$(ctx, "adaptiveRender");
    if (previousMode !== mode) {
        set$(ctx, "adaptiveRender", mode);
        ctx.state.props.adaptiveRender?.onChange?.(mode);
    }
}

export function updateAdaptiveRender(ctx: StateContext, scrollVelocity: number) {
    const state = ctx.state;
    const adaptiveRender = state.props.adaptiveRender;
    const enterVelocity = adaptiveRender?.enterVelocity ?? DEFAULT_ENTER_VELOCITY;
    const exitVelocity = adaptiveRender?.exitVelocity ?? DEFAULT_EXIT_VELOCITY;
    const exitDelay = adaptiveRender?.exitDelay ?? DEFAULT_EXIT_DELAY;
    const currentMode = peek$(ctx, "adaptiveRender");
    const threshold = currentMode === "light" ? exitVelocity : enterVelocity;
    const nextMode = Math.abs(scrollVelocity) > threshold ? "light" : "normal";
    const previousMode = state.timeoutAdaptiveRender !== undefined ? "normal" : currentMode;

    if (nextMode !== previousMode) {
        if (nextMode === "light") {
            setAdaptiveRender(ctx, "light");
            scheduleAdaptiveRenderExit(ctx, exitDelay);
        } else if (currentMode === "light") {
            scheduleAdaptiveRenderExit(ctx, exitDelay);
        }
    }
}
