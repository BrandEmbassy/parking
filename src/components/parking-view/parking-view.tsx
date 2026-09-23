import { component$, type Signal, type QRL } from "@builder.io/qwik";
import type { SpotData, ReserveResult } from "~/services/types";
import { ParkingScene } from "~/components/parking-scene/parking-scene";
import { SpotsGrid } from "~/components/spots-grid/spots-grid";
import { useDesignPreference } from "~/hooks/use-design-preference";

interface ParkingViewProps {
  spots: SpotData[];
  userName?: string;
  editingSpot?: Signal<number | null>;
  changedSpots?: Signal<number[]>;
  reserveResult?: Signal<ReserveResult | null>;
  onSave$?: QRL<
    (spotId: number, value: string, expectedValue: string) => Promise<void>
  >;
}

/**
 * Renders the day's spots in whichever layout the visitor has selected in the
 * header — the classic grid by default, the garage scene when opted in. Both
 * layouts take the same prop contract.
 */
export const ParkingView = component$<ParkingViewProps>((props) => {
  const design = useDesignPreference();

  return design.value === "scene" ? (
    <ParkingScene
      spots={props.spots}
      userName={props.userName}
      editingSpot={props.editingSpot}
      changedSpots={props.changedSpots}
      reserveResult={props.reserveResult}
      onSave$={props.onSave$}
    />
  ) : (
    <SpotsGrid
      spots={props.spots}
      userName={props.userName}
      editingSpot={props.editingSpot}
      changedSpots={props.changedSpots}
      reserveResult={props.reserveResult}
      onSave$={props.onSave$}
    />
  );
});
