import { startOfMonth, endOfMonth, eachDayOfInterval, isFriday, isSaturday, format, addDays, isAfter, isBefore } from "date-fns";
import { DiningEvent } from "../types";

export function generateAutoEvents(): DiningEvent[] {
  const events: DiningEvent[] = [];
  const start = new Date(2026, 3, 1); // April 1, 2026
  const end = new Date(2026, 4, 7); // May 7, 2026 (Week of May 1)

  const days = eachDayOfInterval({ start, end });

  days.forEach((day) => {
    if (isFriday(day)) {
      events.push({
        id: `thali-${format(day, "yyyy-MM-dd")}`,
        title: "Grand Thali Experience",
        description: "A traditional, abundant, communal dining experience celebrating regional heritage.",
        dateTime: format(day, "yyyy-MM-dd'T'19:00:00"),
        capacity: 24,
        type: "thali",
        creditsPerPerson: 6,
        bookedSeats: 0,
      });
    } else if (isSaturday(day)) {
      // Brunch Event
      events.push({
        id: `brunch-${format(day, "yyyy-MM-dd")}`,
        title: "Tiffins & Toast",
        description: "An Anglo-Indian brunch experience. A delightful fusion of colonial heritage and modern breakfast classics.",
        dateTime: format(day, "yyyy-MM-dd'T'12:00:00"),
        capacity: 20,
        type: "brunch",
        creditsPerPerson: 4,
        bookedSeats: 0,
      });

      // Evening Event
      events.push({
        id: `curated-${format(day, "yyyy-MM-dd")}`,
        title: "Curated Dining",
        description: "A seasonal, multi-course tasting experience exploring modern interpretations of fine dining.",
        dateTime: format(day, "yyyy-MM-dd'T'19:30:00"),
        capacity: 16,
        type: "curated",
        creditsPerPerson: 8,
        bookedSeats: 0,
      });
    }
  });

  return events;
}
