export type UserRole = "user" | "admin" | "member";

export interface UserProfile {
  uid: string;
  email: string;
  firstName?: string;
  lastName?: string;
  credits: number;
  role: UserRole;
  membershipProgress: number;
  membershipYear: number;
  notificationPrefs?: {
    confirmations: boolean;
    reminders: boolean;
  };
}

export type EventType = "thali" | "curated" | "brunch";

export interface DiningEvent {
  id: string;
  title: string;
  description: string;
  dateTime: string;
  capacity: number;
  type: EventType;
  creditsPerPerson: number;
  bookedSeats: number;
}

export interface Booking {
  id: string;
  userId: string;
  eventId: string;
  numPeople: number;
  totalCredits: number;
  createdAt: string;
  event?: DiningEvent;
  remindersSent?: {
    twoWeeks?: boolean;
    oneWeek?: boolean;
    dayOf?: boolean;
  };
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  creditsIssued: number;
  type: "purchase" | "booking" | "cancellation";
  timestamp: string;
}

export interface BlogPost {
  id: string;
  title: string;
  content: string;
  author: string;
  publishedAt: string;
  status: "draft" | "published";
}

export interface ContactMessage {
  id: string;
  userId?: string;
  subject: string;
  body: string;
  status: "unread" | "read" | "responded";
  createdAt: string;
}
