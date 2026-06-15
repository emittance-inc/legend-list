import type { InternalState } from "@/types.internal";
import { getId } from "@/utils/getId";

function isNullOrUndefined(value: number | null | undefined) {
    return value === null || value === undefined;
}

function getMountedIndicesInRange(
    state: InternalState,
    start: number | null | undefined,
    end: number | null | undefined,
) {
    if (!isNullOrUndefined(end) && !isNullOrUndefined(start) && start >= 0 && end >= 0) {
        return Array.from(state.containerItemKeys.keys())
            .map((key) => state.indexByKey.get(key))
            .filter((index): index is number => index !== undefined && index >= start && index <= end)
            .sort((a, b) => a - b);
    }
    return [];
}

export function getMountedBufferedIndices(state: InternalState) {
    return getMountedIndicesInRange(state, state.startBuffered, state.endBuffered);
}

export function getMountedNoBufferIndices(state: InternalState) {
    return getMountedIndicesInRange(state, state.startNoBuffer, state.endNoBuffer);
}

export function checkMountedSizesKnownInRange(
    state: InternalState,
    start: number | null | undefined,
    end: number | null | undefined,
) {
    if (isNullOrUndefined(end) || isNullOrUndefined(start) || start < 0 || end < 0) {
        return false;
    }

    let hasMountedIndex = false;
    for (const key of state.containerItemKeys.keys()) {
        const index = state.indexByKey.get(key);
        if (index !== undefined && index >= start && index <= end) {
            hasMountedIndex = true;
            const id = getId(state, index);
            if (id === undefined || !state.sizesKnown.has(id)) {
                return false;
            }
        }
    }

    return hasMountedIndex;
}

export function checkAllSizesKnown(state: InternalState, indices: number[]) {
    return (
        indices.length > 0 &&
        indices.every((index) => {
            const key = getId(state, index);
            return key !== undefined && state.sizesKnown.has(key);
        })
    );
}
