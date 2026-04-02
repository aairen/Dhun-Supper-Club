export interface EmailParams {
  to: string;
  subject: string;
  body: string;
  type: "welcome" | "confirmation" | "reminder";
}

export async function sendEmail(params: EmailParams) {
  console.log(`[FRONTEND EMAIL ATTEMPT] To: ${params.to}, Type: ${params.type}`);
  try {
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });
    
    if (!response.ok) {
      throw new Error("Failed to send email");
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error sending email:", error);
    // We don't throw here to avoid breaking the main flow
    return null;
  }
}

export const emailTemplates = {
  welcome: (name: string) => ({
    subject: "Welcome to Dhun Supper Club",
    body: `
      <div style="font-family: serif; color: #171717; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e5e5e5;">
        <h1 style="text-transform: uppercase; letter-spacing: 0.2em; text-align: center; font-size: 24px; margin-bottom: 40px;">Dhun</h1>
        <p style="font-size: 18px; line-height: 1.6; margin-bottom: 24px;">Hello ${name},</p>
        <p style="font-size: 16px; line-height: 1.6; color: #525252; margin-bottom: 24px;">
          Welcome to Dhun Supper Club. We are delighted to have you as part of our community of food explorers.
        </p>
        <p style="font-size: 16px; line-height: 1.6; color: #525252; margin-bottom: 40px;">
          You can now browse our upcoming Curated Collection and secure your seat at our table.
        </p>
        <div style="text-align: center;">
          <a href="${window.location.origin}/events" style="background-color: #171717; color: white; padding: 16px 32px; text-decoration: none; text-transform: uppercase; font-size: 12px; font-weight: bold; letter-spacing: 0.1em;">Browse Experiences</a>
        </div>
        <hr style="margin: 60px 0 30px; border: 0; border-top: 1px solid #e5e5e5;" />
        <p style="font-size: 12px; color: #a3a3a3; text-align: center; text-transform: uppercase; letter-spacing: 0.1em;">
          Dhun Supper Club • Curated Collection
        </p>
      </div>
    `
  }),
  confirmation: (name: string, eventName: string, dateTime: string, guests: number, credits: number) => ({
    subject: `Reservation Confirmed: ${eventName}`,
    body: `
      <div style="font-family: serif; color: #171717; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e5e5e5;">
        <h1 style="text-transform: uppercase; letter-spacing: 0.2em; text-align: center; font-size: 24px; margin-bottom: 40px;">Reservation Confirmed</h1>
        <p style="font-size: 18px; line-height: 1.6; margin-bottom: 24px;">Hello ${name},</p>
        <p style="font-size: 16px; line-height: 1.6; color: #525252; margin-bottom: 24px;">
          Your reservation for <strong>${eventName}</strong> has been successfully confirmed.
        </p>
        <div style="background-color: #f9f9f9; padding: 24px; margin-bottom: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: #737373;">Details</p>
          <p style="margin: 0 0 8px; font-size: 16px;"><strong>Date & Time:</strong> ${dateTime}</p>
          <p style="margin: 0 0 8px; font-size: 16px;"><strong>Guests:</strong> ${guests}</p>
          <p style="margin: 0; font-size: 16px;"><strong>Credits Used:</strong> ${credits}</p>
        </div>
        <p style="font-size: 16px; line-height: 1.6; color: #525252; margin-bottom: 40px;">
          We look forward to hosting you soon. If you need to cancel or modify your reservation, please do so via your dashboard at least 14 days prior to the event.
        </p>
        <div style="text-align: center;">
          <a href="${window.location.origin}/dashboard" style="background-color: #171717; color: white; padding: 16px 32px; text-decoration: none; text-transform: uppercase; font-size: 12px; font-weight: bold; letter-spacing: 0.1em;">View Dashboard</a>
        </div>
      </div>
    `
  }),
  reminder: (name: string, eventName: string, dateTime: string, timeFrame: string) => ({
    subject: `Reminder: ${eventName} is ${timeFrame}`,
    body: `
      <div style="font-family: serif; color: #171717; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e5e5e5;">
        <h1 style="text-transform: uppercase; letter-spacing: 0.2em; text-align: center; font-size: 24px; margin-bottom: 40px;">Experience Reminder</h1>
        <p style="font-size: 18px; line-height: 1.6; margin-bottom: 24px;">Hello ${name},</p>
        <p style="font-size: 16px; line-height: 1.6; color: #525252; margin-bottom: 24px;">
          This is a reminder that your experience <strong>${eventName}</strong> is ${timeFrame}.
        </p>
        <div style="background-color: #f9f9f9; padding: 24px; margin-bottom: 32px;">
          <p style="margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: #737373;">Details</p>
          <p style="margin: 0 0 8px; font-size: 16px;"><strong>Date & Time:</strong> ${dateTime}</p>
        </div>
        <p style="font-size: 16px; line-height: 1.6; color: #525252; margin-bottom: 40px;">
          We are excited to see you soon.
        </p>
        <div style="text-align: center;">
          <a href="${window.location.origin}/dashboard" style="background-color: #171717; color: white; padding: 16px 32px; text-decoration: none; text-transform: uppercase; font-size: 12px; font-weight: bold; letter-spacing: 0.1em;">View Details</a>
        </div>
      </div>
    `
  })
};
