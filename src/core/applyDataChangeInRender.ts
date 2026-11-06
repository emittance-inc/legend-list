import { IsNewArchitecture } from "@/constants-platform";
import { calculateItemsInView } from "@/core/calculateItemsInView";
import { Platform } from "@/platform/Platform";
import { peek$, type StateContext } from "@/state/state";

// Reassigning containers in the render that receives new data puts the new rows in the same
// commit as the data. Left to the layout effect they arrive one commit later, and until then
// a container shows an item that is gone or, with it hidden, nothing.
//
// Only state and signals may change during a render. A list that also has to move the scroll
// position for a data change keeps the layout effect path.
export function canApplyDataChangeInRender(ctx: StateContext) {
    const state = ctx.state;
    const { anchoredEndSpace, maintainScrollAtEnd, maintainVisibleContentPosition } = state.props;

    return (
        !state.isFirst &&
        !state.didColumnsChange &&
        !maintainVisibleContentPosition.data &&
        !maintainScrollAtEnd &&
        !anchoredEndSpace &&
        !!state.didContainersLayout &&
        !!peek$(ctx, "readyToRender") &&
        peek$(ctx, "numContainers") > 0 &&
        state.scrollLength > 0 &&
        !state.initialScroll &&
        !state.initialScrollSession &&
        // The old architecture corrects a data change on Android with a scroll command.
        (IsNewArchitecture || Platform.OS !== "android")
    );
}

export function applyDataChangeInRender(ctx: StateContext) {
    const { renderUpdate, state } = ctx;

    renderUpdate.isActive = true;
    try {
        calculateItemsInView(ctx, { dataChanged: true, doMVCP: true });
    } finally {
        renderUpdate.isActive = false;
    }

    renderUpdate.epoch += 1;
    state.appliedDataChangeEpoch = state.dataChangeEpoch;
}
