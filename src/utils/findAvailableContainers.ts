import { peek$, type StateContext } from "@/state/state";
import { IS_DEV } from "@/utils/devEnvironment";

export interface ContainerAllocation {
    containerIndex: number;
    itemIndex: number;
    itemType?: string;
}

interface NeededContainer {
    itemIndex: number;
    itemType: string | undefined;
}

export function findAvailableContainers(
    ctx: StateContext,
    needNewContainers: number[],
    startBuffered: number,
    endBuffered: number,
    pendingRemoval: number[],
    requiredItemTypes?: string[],
    protectedKeys?: Set<string>,
): ContainerAllocation[] {
    const numNeeded = needNewContainers.length;
    if (numNeeded === 0) {
        return [];
    }

    const numContainers = peek$(ctx, "numContainers");
    const state = ctx.state;

    const { stickyContainerPool, containerItemTypes } = state;
    const shouldAvoidAssignedContainerReuse = state.props.recycleItems && !!state.props.positionComponentInternal;

    const allocationsByNeededIndex: Array<ContainerAllocation | undefined> = [];
    const availableContainers: Array<{ index: number; distance: number }> = [];
    const neededContainers: NeededContainer[] = needNewContainers.map((itemIndex, index) => ({
        itemIndex,
        itemType: requiredItemTypes?.[index],
    }));

    const pendingRemovalSet = pendingRemoval.length > 0 ? new Set(pendingRemoval) : undefined;
    let pendingRemovalChanged = false;
    let nextNewContainerIndex = numContainers;

    const stickyHeaderIndicesSet = state.props.stickyHeaderIndicesSet;

    // Helper function to check if a container can be reused for a given item type
    const canReuseContainer = (containerIndex: number, requiredType: string | undefined): boolean => {
        if (!requiredType) return true; // No type requirement, can reuse any container

        const existingType = containerItemTypes.get(containerIndex);
        if (!existingType) return true; // Untyped container can be reused for any type

        return existingType === requiredType;
    };

    let allocationCount = 0;
    let nextNeededIndex = 0;
    let allocatedNeededIndices: Set<number> | undefined;
    let selectedContainers: Set<number> | undefined;

    const pushAllocation = (neededIndex: number, containerIndex: number) => {
        const needed = neededContainers[neededIndex];
        allocationsByNeededIndex[neededIndex] = {
            containerIndex,
            itemIndex: needed.itemIndex,
            itemType: needed.itemType,
        };
        allocationCount++;
        allocatedNeededIndices?.add(neededIndex);
        selectedContainers?.add(containerIndex);
    };

    const pushNewContainer = (neededIndex: number) => {
        const newContainerIndex = nextNewContainerIndex++;
        pushAllocation(neededIndex, newContainerIndex);
        return newContainerIndex;
    };

    const getNextNeededIndex = () => {
        while (nextNeededIndex < numNeeded && allocatedNeededIndices?.has(nextNeededIndex)) {
            nextNeededIndex++;
        }
        return nextNeededIndex < numNeeded ? nextNeededIndex : undefined;
    };

    // Handle sticky items first - allocate from sticky container pool
    if (stickyHeaderIndicesSet.size > 0) {
        allocatedNeededIndices = new Set();
        selectedContainers = new Set();
        for (let neededIndex = 0; neededIndex < numNeeded && allocationCount < numNeeded; neededIndex++) {
            const needed = neededContainers[neededIndex];
            if (!stickyHeaderIndicesSet.has(needed.itemIndex)) {
                continue;
            }

            // Try to find available sticky container
            let foundContainer = false;
            for (const containerIndex of stickyContainerPool) {
                const key = peek$(ctx, `containerItemKey${containerIndex}`);
                const isPendingRemoval = !!pendingRemovalSet?.has(containerIndex);

                if (
                    (key === undefined || isPendingRemoval) &&
                    canReuseContainer(containerIndex, needed.itemType) &&
                    !selectedContainers.has(containerIndex)
                ) {
                    pushAllocation(neededIndex, containerIndex);
                    if (isPendingRemoval && pendingRemovalSet?.delete(containerIndex)) {
                        pendingRemovalChanged = true;
                    }
                    foundContainer = true;
                    break;
                }
            }

            // If no available sticky container, create a new one
            if (!foundContainer) {
                const newContainerIndex = pushNewContainer(neededIndex);
                stickyContainerPool.add(newContainerIndex);
            }
        }
    }

    // For non-sticky items, always try to allocate from non-sticky containers first
    // First pass: collect unallocated non-sticky containers (most efficient to use)
    for (let u = 0; u < numContainers && allocationCount < numNeeded; u++) {
        // Skip if this is a sticky container
        if (stickyContainerPool.has(u)) {
            continue;
        }

        const neededIndex = getNextNeededIndex();
        if (neededIndex === undefined) {
            break;
        }

        const needed = neededContainers[neededIndex];
        const key = peek$(ctx, `containerItemKey${u}`);
        const isPending = key !== undefined && !!pendingRemovalSet?.has(u);
        const canUse = key === undefined || (isPending && canReuseContainer(u, needed.itemType));

        // Defer clearing pendingRemoval until after we know the type matches,
        // otherwise incompatible containers get unmarked and linger on screen.
        if (canUse) {
            if (isPending) {
                selectedContainers ??= new Set();
                pendingRemovalSet?.delete(u);
                pendingRemovalChanged = true;
            }
            pushAllocation(neededIndex, u);
            nextNeededIndex = neededIndex + 1;
        }
    }

    // Recycled layout-animation containers cannot safely swap item identity and
    // position independently, so skip assigned-container reuse in that mode.
    if (!shouldAvoidAssignedContainerReuse) {
        // Second pass: collect non-sticky containers that are out of view
        for (let u = 0; u < numContainers && allocationCount < numNeeded; u++) {
            // Skip if this is a sticky container
            if (stickyContainerPool.has(u)) {
                continue;
            }

            const key = peek$(ctx, `containerItemKey${u}`);
            if (key === undefined) continue; // Skip already collected containers
            if (selectedContainers?.has(u)) continue;
            if (protectedKeys?.has(key) && state.indexByKey.has(key)) continue;

            const index = state.indexByKey.get(key)!;
            const isOutOfView = index < startBuffered || index > endBuffered;

            if (isOutOfView) {
                const distance = index < startBuffered ? startBuffered - index : index - endBuffered;

                availableContainers.push({ distance, index: u });
            }
        }
    }

    // If we need more containers than we have available so far
    const remaining = numNeeded - allocationCount;
    if (remaining > 0) {
        if (availableContainers.length > 0) {
            // Sort by distance (furthest first) so recycling prefers items farthest from the buffered range.
            availableContainers.sort(comparatorByDistance);
        }

        while (allocationCount < numNeeded) {
            const neededIndex = getNextNeededIndex();
            if (neededIndex === undefined) {
                break;
            }

            const needed = neededContainers[neededIndex];
            let matchingAvailableIndex = -1;
            for (let i = 0; i < availableContainers.length && matchingAvailableIndex === -1; i++) {
                if (canReuseContainer(availableContainers[i].index, needed.itemType)) {
                    matchingAvailableIndex = i;
                }
            }

            if (matchingAvailableIndex >= 0) {
                const [container] = availableContainers.splice(matchingAvailableIndex, 1);
                pushAllocation(neededIndex, container.index);
            } else {
                pushNewContainer(neededIndex);
            }
            nextNeededIndex = neededIndex + 1;
        }

        if (IS_DEV && nextNewContainerIndex > peek$(ctx, "numContainersPooled")) {
            console.warn(
                "[legend-list] No unused container available, so creating one on demand. This can be a minor performance issue and is likely caused by the estimatedItemSize being too large. Consider decreasing estimatedItemSize.",
                {
                    debugInfo: {
                        numContainers,
                        numContainersPooled: peek$(ctx, "numContainersPooled"),
                        numNeeded,
                        stillNeeded: nextNewContainerIndex - numContainers,
                    },
                },
            );
        }
    }

    if (pendingRemovalChanged) {
        pendingRemoval.length = 0;
        if (pendingRemovalSet) {
            for (const value of pendingRemovalSet) {
                pendingRemoval.push(value);
            }
        }
    }

    return allocationsByNeededIndex.filter((allocation): allocation is ContainerAllocation => allocation !== undefined);
}

function comparatorByDistance(a: { distance: number }, b: { distance: number }) {
    return b.distance - a.distance;
}
