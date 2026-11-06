// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";

import { Container } from "@/components/Container";
import { useArr$ } from "@/state/state";
import type { StickyHeaderConfig } from "@/types.base";
import { type GetRenderedItem, typedMemo } from "@/types.internal";

export interface ContainerComponentProps<ItemT> {
    horizontal: boolean;
    id: number;
    itemKey: string;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ComponentType<{ leadingItem: ItemT }>;
    getRenderedItem: GetRenderedItem;
    // Changes when a render wrote this container's signals, which it could not announce.
    renderVersion?: number;
    stickyHeaderConfig?: StickyHeaderConfig;
}

export interface ContainerSlotProps<ItemT> extends Omit<ContainerComponentProps<ItemT>, "itemKey"> {
    activeItemKeys: ReadonlySet<string> | undefined;
    ContainerComponent?: React.ComponentType<ContainerComponentProps<ItemT>>;
}

export function ContainerSlotBase<ItemT>({
    activeItemKeys,
    id,
    horizontal,
    recycleItems,
    ItemSeparatorComponent,
    getRenderedItem,
    renderVersion,
    stickyHeaderConfig,
    ContainerComponent = Container,
}: ContainerSlotProps<ItemT>) {
    const [itemKey] = useArr$([`containerItemKey${id}`]);

    if (itemKey === undefined || (activeItemKeys && !activeItemKeys.has(itemKey))) {
        return null;
    }

    return (
        <ContainerComponent
            getRenderedItem={getRenderedItem}
            horizontal={horizontal}
            ItemSeparatorComponent={ItemSeparatorComponent}
            id={id}
            itemKey={itemKey}
            recycleItems={recycleItems}
            renderVersion={renderVersion}
            stickyHeaderConfig={stickyHeaderConfig}
        />
    );
}

// biome-ignore lint/nursery/noShadow: const function name shadowing is intentional
export const ContainerSlot = typedMemo(function ContainerSlot<ItemT>(props: ContainerSlotProps<ItemT>) {
    return <ContainerSlotBase {...props} />;
});
