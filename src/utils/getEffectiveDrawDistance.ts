import { peek$, type StateContext } from "@/state/state";

export const INITIAL_DRAW_DISTANCE = 100;

export function getEffectiveDrawDistance(ctx: StateContext): number {
    const drawDistance = ctx.state.props.drawDistance;
    return peek$(ctx, "readyToRender") ? drawDistance : Math.min(drawDistance, INITIAL_DRAW_DISTANCE);
}
