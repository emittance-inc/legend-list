import { peek$, type StateContext } from "@/state/state";
import { IS_DEV } from "@/utils/devEnvironment";
import { comparatorDefault } from "@/utils/helpers";

export function findAvailableContainers(
    ctx: StateContext,
    numNeeded: number,
    startBuffered: number,
    endBuffered: number,
    pendingRemoval: number[],
    requiredItemTypes?: string[],
    needNewContainers?: number[],
    protectedKeys?: Set<string>,
): number[] {
    if (numNeeded === 0) {
        return [];
    }

    const numContainers = peek$(ctx, "numContainers");
    const state = ctx.state;

    const { stickyContainerPool, containerItemTypes } = state;
    const shouldAvoidAssignedContainerReuse = state.props.recycleItems && !!state.props.positionComponentInternal;

    const result: number[] = [];
    const availableContainers: Array<{ index: number; distance: number }> = [];

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

    // Track which types we still need containers for
    const neededTypes = requiredItemTypes;
    let typeIndex = 0;
    let selectedContainers: Set<number> | undefined;

    const pushResult = (containerIndex: number) => {
        result.push(containerIndex);
        selectedContainers?.add(containerIndex);
    };

    const pushNewContainer = () => {
        const newContainerIndex = nextNewContainerIndex++;
        pushResult(newContainerIndex);
        return newContainerIndex;
    };

    // Handle sticky items first - allocate from sticky container pool
    if (needNewContainers && stickyHeaderIndicesSet.size > 0) {
        selectedContainers = new Set();
        for (let i = 0; i < needNewContainers.length && result.length < numNeeded; i++) {
            const itemIndex = needNewContainers[i];
            if (!stickyHeaderIndicesSet.has(itemIndex)) {
                continue;
            }

            const requiredType = neededTypes?.[typeIndex];

            // Try to find available sticky container
            let foundContainer = false;
            for (const containerIndex of stickyContainerPool) {
                const key = peek$(ctx, `containerItemKey${containerIndex}`);
                const isPendingRemoval = !!pendingRemovalSet?.has(containerIndex);

                if (
                    (key === undefined || isPendingRemoval) &&
                    canReuseContainer(containerIndex, requiredType) &&
                    !selectedContainers.has(containerIndex)
                ) {
                    pushResult(containerIndex);
                    if (isPendingRemoval && pendingRemovalSet?.delete(containerIndex)) {
                        pendingRemovalChanged = true;
                    }
                    foundContainer = true;
                    if (requiredItemTypes) typeIndex++;
                    break;
                }
            }

            // If no available sticky container, create a new one
            if (!foundContainer) {
                const newContainerIndex = pushNewContainer();
                stickyContainerPool.add(newContainerIndex);
                if (requiredItemTypes) typeIndex++;
            }
        }
    }

    // For non-sticky items, always try to allocate from non-sticky containers first
    // First pass: collect unallocated non-sticky containers (most efficient to use)
    for (let u = 0; u < numContainers && result.length < numNeeded; u++) {
        // Skip if this is a sticky container
        if (stickyContainerPool.has(u)) {
            continue;
        }

        const key = peek$(ctx, `containerItemKey${u}`);
        const requiredType = neededTypes?.[typeIndex];
        const isPending = key !== undefined && !!pendingRemovalSet?.has(u);
        const canUse = key === undefined || (isPending && canReuseContainer(u, requiredType));

        // Defer clearing pendingRemoval until after we know the type matches,
        // otherwise incompatible containers get unmarked and linger on screen.
        if (canUse) {
            if (isPending) {
                pendingRemovalSet?.delete(u);
                pendingRemovalChanged = true;
            }
            pushResult(u);
            if (requiredItemTypes) {
                typeIndex++;
            }
        }
    }

    // Recycled layout-animation containers cannot safely swap item identity and
    // position independently, so skip assigned-container reuse in that mode.
    if (!shouldAvoidAssignedContainerReuse) {
        // Second pass: collect non-sticky containers that are out of view
        for (let u = 0; u < numContainers && result.length < numNeeded; u++) {
            // Skip if this is a sticky container
            if (stickyContainerPool.has(u)) {
                continue;
            }

            const key = peek$(ctx, `containerItemKey${u}`);
            if (key === undefined) continue; // Skip already collected containers
            if (protectedKeys?.has(key) && state.indexByKey.has(key)) continue;

            const index = state.indexByKey.get(key)!;
            const isOutOfView = index < startBuffered || index > endBuffered;

            if (isOutOfView) {
                const distance = index < startBuffered ? startBuffered - index : index - endBuffered;

                if (
                    !requiredItemTypes ||
                    (neededTypes && typeIndex < neededTypes.length && canReuseContainer(u, neededTypes[typeIndex]))
                ) {
                    availableContainers.push({ distance, index: u });
                }
            }
        }
    }

    // If we need more containers than we have available so far
    const remaining = numNeeded - result.length;
    if (remaining > 0) {
        if (availableContainers.length > 0) {
            // Only sort if we need to
            if (availableContainers.length > remaining) {
                // Sort by distance (furthest first)
                availableContainers.sort(comparatorByDistance);
                // Take just what we need
                availableContainers.length = remaining;
            }

            // Add to result, keeping track of original indices and type requirements
            for (const container of availableContainers) {
                pushResult(container.index);
                if (requiredItemTypes) {
                    typeIndex++;
                }
            }
        }

        // If we still need more, create new containers
        const stillNeeded = numNeeded - result.length;
        if (stillNeeded > 0) {
            for (let i = 0; i < stillNeeded; i++) {
                pushNewContainer();
            }

            if (IS_DEV && nextNewContainerIndex > peek$(ctx, "numContainersPooled")) {
                console.warn(
                    "[legend-list] No unused container available, so creating one on demand. This can be a minor performance issue and is likely caused by the estimatedItemSize being too large. Consider decreasing estimatedItemSize.",
                    {
                        debugInfo: {
                            numContainers,
                            numContainersPooled: peek$(ctx, "numContainersPooled"),
                            numNeeded,
                            stillNeeded,
                        },
                    },
                );
            }
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

    // Sort by index for consistent ordering
    return result.sort(comparatorDefault);
}

function comparatorByDistance(a: { distance: number }, b: { distance: number }) {
    return b.distance - a.distance;
}
