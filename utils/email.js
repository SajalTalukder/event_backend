// utils/sendEmail.js
import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not set in environment variables");
}

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async ({ email, subject, html }) => {
  try {
    const response = await resend.emails.send({
      from: "PhotoFlow <noreply@webdevwarriors.com>", // must be verified
      to: email,
      subject,
      html,
    });
    console.log("✅ Email sent! Resend ID:", response.id);
    return response;
  } catch (err) {
    console.error("❌ Failed to send email:", err);
    throw err;
  }
};
