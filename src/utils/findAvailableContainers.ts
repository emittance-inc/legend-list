import { peek$, type StateContext } from "@/state/state";
import { IS_DEV } from "@/utils/devEnvironment";

export interface ContainerAllocation {
    containerIndex: number;
    itemIndex: number;
    itemType?: string;
}

interface AvailableContainer {
    containerIndex: number;
    distance: number;
}

interface RequestedContainer {
    isSticky: boolean;
    itemIndex: number;
    itemType?: string;
    order: number;
}

export function findAvailableContainers(
    ctx: StateContext,
    needNewContainers: number[],
    startBuffered: number,
    endBuffered: number,
    pendingRemoval: number[],
    getRequiredItemType?: (itemIndex: number) => string | undefined,
    protectedKeys?: Set<string>,
): ContainerAllocation[] {
    const numNeeded = needNewContainers.length;
    if (numNeeded === 0) {
        return [];
    }

    const numContainers = peek$(ctx, "numContainers");
    const numContainersPooled = peek$(ctx, "numContainersPooled") ?? Number.POSITIVE_INFINITY;
    const state = ctx.state;
    const { containerItemTypes, stickyContainerPool } = state;
    const shouldAvoidAssignedContainerReuse = state.props.recycleItems && !!state.props.positionComponentInternal;
    const pendingRemovalSet = pendingRemoval.length > 0 ? new Set(pendingRemoval) : undefined;

    const requests: RequestedContainer[] = needNewContainers.map((itemIndex, order) => ({
        isSticky: state.props.stickyHeaderIndicesSet.has(itemIndex),
        itemIndex,
        itemType: getRequiredItemType?.(itemIndex),
        order,
    }));
    const normalRequests = requests.filter((request) => !request.isSticky);
    const stickyRequests = requests.filter((request) => request.isSticky);
    const normalCandidates: AvailableContainer[] = [];
    const stickyCandidates: AvailableContainer[] = [];

    for (let containerIndex = 0; containerIndex < numContainers; containerIndex++) {
        const key = peek$(ctx, `containerItemKey${containerIndex}`);
        const isPendingRemoval = !!pendingRemovalSet?.has(containerIndex);
        const isProtected = !!key && !!protectedKeys?.has(key) && state.indexByKey.has(key);

        if (isProtected) {
            continue;
        }

        if (stickyContainerPool.has(containerIndex)) {
            if (key === undefined || isPendingRemoval) {
                stickyCandidates.push({ containerIndex, distance: Number.POSITIVE_INFINITY });
            }
        } else if (key === undefined || isPendingRemoval) {
            normalCandidates.push({ containerIndex, distance: Number.POSITIVE_INFINITY });
        } else if (!shouldAvoidAssignedContainerReuse) {
            const index = state.indexByKey.get(key);
            if (index !== undefined && (index < startBuffered || index > endBuffered)) {
                const distance = index < startBuffered ? startBuffered - index : index - endBuffered;
                normalCandidates.push({ containerIndex, distance });
            }
        }
    }

    normalCandidates.sort(comparatorByDistance);
    const allocations: Array<ContainerAllocation & { order: number }> = [];
    const unresolved = new Set(requests);
    let nextNewContainerIndex = numContainers;
    let pendingRemovalChanged = false;

    const assign = (request: RequestedContainer, containerIndex: number) => {
        allocations.push({
            containerIndex,
            itemIndex: request.itemIndex,
            itemType: request.itemType,
            order: request.order,
        });
        unresolved.delete(request);
        if (pendingRemovalSet?.delete(containerIndex)) {
            pendingRemovalChanged = true;
        }
    };

    const assignMatching = (
        pendingRequests: RequestedContainer[],
        candidates: AvailableContainer[],
        matches: (containerType: string | undefined, requestType: string | undefined) => boolean,
    ) => {
        for (const request of pendingRequests) {
            if (!unresolved.has(request)) {
                continue;
            }

            const candidateIndex = candidates.findIndex((candidate) =>
                matches(containerItemTypes.get(candidate.containerIndex), request.itemType),
            );
            if (candidateIndex !== -1) {
                const [candidate] = candidates.splice(candidateIndex, 1);
                assign(request, candidate.containerIndex);
            }
        }
    };

    const assignFromPool = (
        pendingRequests: RequestedContainer[],
        candidates: AvailableContainer[],
        allowCrossType: boolean,
    ) => {
        // Preserve matching containers for every request in the batch before
        // consuming untyped or differently typed containers.
        assignMatching(
            pendingRequests,
            candidates,
            (containerType, requestType) => requestType !== undefined && containerType === requestType,
        );
        assignMatching(pendingRequests, candidates, (containerType) => containerType === undefined);
        if (allowCrossType) {
            assignMatching(pendingRequests, candidates, () => true);
        }
    };

    assignFromPool(normalRequests, normalCandidates, true);
    assignFromPool(stickyRequests, stickyCandidates, false);

    for (const request of requests) {
        if (!unresolved.has(request)) {
            continue;
        }

        const containerIndex = nextNewContainerIndex++;
        if (request.isSticky) {
            stickyContainerPool.add(containerIndex);
        }
        assign(request, containerIndex);
    }

    if (pendingRemovalChanged) {
        pendingRemoval.length = 0;
        if (pendingRemovalSet) {
            for (const value of pendingRemovalSet) {
                pendingRemoval.push(value);
            }
        }
    }

    if (IS_DEV && nextNewContainerIndex > numContainersPooled) {
        console.warn(
            "[legend-list] No unused container available, so creating one on demand. This can be a minor performance issue and is likely caused by the estimatedItemSize being too large. Consider decreasing estimatedItemSize.",
            {
                debugInfo: {
                    numContainers,
                    numContainersPooled,
                    numNeeded,
                    stillNeeded: nextNewContainerIndex - numContainers,
                },
            },
        );
    }

    return allocations
        .sort((a, b) => a.order - b.order)
        .map(({ containerIndex, itemIndex, itemType }) => ({ containerIndex, itemIndex, itemType }));
}

function comparatorByDistance(a: AvailableContainer, b: AvailableContainer) {
    return b.distance - a.distance || a.containerIndex - b.containerIndex;
}
