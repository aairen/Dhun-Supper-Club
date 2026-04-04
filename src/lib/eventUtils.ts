import { eachDayOfInterval, isFriday, isSaturday, isSunday, format } from "date-fns";
import { DiningEvent } from "../types";

export function generateAutoEvents(startDate?: Date, endDate?: Date): DiningEvent[] {
  const events: DiningEvent[] = [];
  const start = startDate || new Date(2026, 3, 1); // April 1, 2026
  const end = endDate || new Date(2026, 5, 7); // June 7, 2026

  const days = eachDayOfInterval({ start, end });

  days.forEach((day) => {
    if (isFriday(day)) {
      // Culinary Experience (Every Friday at 7:00 PM)
      events.push({
        id: `curated-${format(day, "yyyy-MM-dd")}`,
        title: "Curated Dining",
        description: "A seasonal, multi-course tasting experience exploring modern interpretations of fine dining.",
        dateTime: format(day, "yyyy-MM-dd'T'19:00:00"),
        capacity: 16,
        type: "curated",
        creditsPerPerson: 7,
        bookedSeats: 0,
      });
    } else if (isSaturday(day)) {
      // Cooking Class (Every Saturday at 10:30 AM)
      events.push({
        id: `hands-on-${format(day, "yyyy-MM-dd")}`,
        title: "Hands-On Cooking",
        description: "Learn to cook healthy home-style meals using fresh seasonal ingredients in an interactive 2-hour session.",
        dateTime: format(day, "yyyy-MM-dd'T'10:30:00"),
        capacity: 12,
        type: "hands-on",
        creditsPerPerson: 4,
        bookedSeats: 0,
      });
    } else if (isSunday(day)) {
      // Alternating Sundays logic
      // We use the week number from a fixed reference point to ensure consistency
      const referenceDate = new Date(2026, 3, 5); // April 5, 2026 (A Thali Sunday)
      const diffWeeks = Math.floor((day.getTime() - referenceDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const isThaliSunday = diffWeeks % 2 === 0;

      if (isThaliSunday) {
        // Thali (Alternate Sundays: 11:00 AM, 2:00 PM)
        events.push({
          id: `thali-11-${format(day, "yyyy-MM-dd")}`,
          title: "Grand Thali Experience",
          description: "A traditional, abundant, communal dining experience celebrating regional heritage.",
          dateTime: format(day, "yyyy-MM-dd'T'11:00:00"),
          capacity: 24,
          type: "thali",
          creditsPerPerson: 6,
          bookedSeats: 0,
        });
        events.push({
          id: `thali-14-${format(day, "yyyy-MM-dd")}`,
          title: "Grand Thali Experience",
          description: "A traditional, abundant, communal dining experience celebrating regional heritage.",
          dateTime: format(day, "yyyy-MM-dd'T'14:00:00"),
          capacity: 24,
          type: "thali",
          creditsPerPerson: 6,
          bookedSeats: 0,
        });
      } else {
        // Brunch (Alternating Sundays: 10:00 AM, 1:00 PM)
        events.push({
          id: `brunch-10-${format(day, "yyyy-MM-dd")}`,
          title: "Tiffins & Toast",
          description: "An Anglo-Indian brunch experience. A delightful fusion of colonial heritage and modern breakfast classics.",
          dateTime: format(day, "yyyy-MM-dd'T'10:00:00"),
          capacity: 20,
          type: "brunch",
          creditsPerPerson: 4,
          bookedSeats: 0,
        });
        events.push({
          id: `brunch-13-${format(day, "yyyy-MM-dd")}`,
          title: "Tiffins & Toast",
          description: "An Anglo-Indian brunch experience. A delightful fusion of colonial heritage and modern breakfast classics.",
          dateTime: format(day, "yyyy-MM-dd'T'13:00:00"),
          capacity: 20,
          type: "brunch",
          creditsPerPerson: 4,
          bookedSeats: 0,
        });
      }
    }
  });

  return events;
}
