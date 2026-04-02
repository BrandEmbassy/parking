import { component$ } from "@builder.io/qwik";
import { type DocumentHead, Link } from "@builder.io/qwik-city";
import { ConnectionStatus } from "~/components/poll-status/poll-status";
import { useSpacetimeDays } from "~/hooks/use-spacetimedb";
import { formatDate } from "~/services/date-utils";

import { useSession } from "../layout";

/**
 * Generate the next N weekday dates starting from today.
 */
function getUpcomingDates(count: number): string[] {
  const dates: string[] = [];
  const d = new Date();
  while (dates.length < count) {
    const day = d.getDay();
    // Include weekdays only (1=Mon..5=Fri), skip weekends
    if (day >= 1 && day <= 5) {
      dates.push(formatDate(d));
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export default component$(() => {
  const session = useSession();
  const upcomingDates = getUpcomingDates(15);

  const { days, connected, error, changedDates } =
    useSpacetimeDays(upcomingDates);

  if (!session.value.isLoggedIn) {
    return (
      <div class="container">
        <h1>Upcoming Days</h1>
        <div class="card">
          <p class="text-center text-muted">
            Please sign in with Google to view upcoming parking availability.
          </p>
        </div>
      </div>
    );
  }

  if (days.value.length === 0) {
    return (
      <div class="container">
        <h1>Upcoming Days</h1>
        <div class="card">
          <p class="text-center text-muted">
            {error.value ? `Error: ${error.value}` : "Loading parking data…"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div class="container">
      <h1>Upcoming Days</h1>
      <p class="subtitle">Next 14 days parking availability</p>

      <div class="days-list">
        {days.value.map((dayData, i) => {
          const freeCount = dayData.spots.filter((s) => !s.occupant).length;
          const totalSpots = dayData.spots.length;
          const dateEncoded = encodeURIComponent(dayData.date);
          const isToday = i === 0;
          const isChanged = changedDates.value.includes(dayData.date);
          const mySpot = dayData.spots.find(
            (s) =>
              s.occupant &&
              s.occupant.toLowerCase() ===
                session.value.name.toLowerCase(),
          );

          return (
            <Link
              key={dayData.date}
              href={isToday ? "/" : `/day/${dateEncoded}`}
              class={`day-row ${freeCount === 0 ? "day-full" : ""} ${isToday ? "day-today" : ""} ${isChanged ? "day-row-changed" : ""} ${mySpot ? "day-mine" : ""}`}
            >
              <div class="day-info">
                <span class="day-date">{dayData.date}</span>
                <span class="day-name">{dayData.day}</span>
                {mySpot && (
                  <span class="day-my-spot">Spot {mySpot.name}</span>
                )}
              </div>
              <div class="day-availability">
                <span
                  class={`availability-badge ${freeCount === 0 ? "badge-full" : freeCount <= 3 ? "badge-low" : "badge-available"}`}
                >
                  {freeCount} / {totalSpots} free
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <ConnectionStatus connected={connected} error={error} />
    </div>
  );
});

export const head: DocumentHead = {
  title: "NiCE Prague Parking - Upcoming",
  meta: [
    {
      name: "description",
      content: "View parking availability for upcoming days",
    },
  ],
};
