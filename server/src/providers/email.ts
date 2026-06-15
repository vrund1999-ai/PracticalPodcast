import nodemailer, { type Transporter } from "nodemailer";
import { env, getOptionalEnv } from "../config/env";

// Email is sent through Gmail SMTP (no domain needed). Set GMAIL_USER + a Google
// App Password (GMAIL_APP_PASSWORD) in .env. Without them, codes fall back to
// the server console so the flow always works in dev.

let transporter: Transporter | null = null;

function getTransport(): Transporter | null {
  const user = getOptionalEnv("GMAIL_USER");
  const pass = getOptionalEnv("GMAIL_APP_PASSWORD");
  if (!user || !pass) return null;
  transporter ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass: pass.replace(/\s+/g, "") }, // app passwords are shown with spaces
  });
  return transporter;
}

function fromAddress(): string {
  const user = getOptionalEnv("GMAIL_USER");
  const explicit = getOptionalEnv("FROM_EMAIL");
  // Gmail rewrites a From that isn't the authenticated account, so only honor an
  // explicit FROM_EMAIL when it actually contains the Gmail address.
  if (explicit && user && explicit.includes(user)) return explicit;
  return user ? `PracticalPodcast <${user}>` : "PracticalPodcast";
}

/** Send the 6-digit sign-in code. Without Gmail creds (or as a fallback on
 *  failure) the code is logged to the server console so sign-in always works. */
export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const t = getTransport();
  if (!t || env.DEV_LOG_OTP) {
    console.log(`\n[DEV OTP] ${email}  ->  ${code}   (expires in 10 min)\n`);
  }
  if (!t) return;

  try {
    await t.sendMail({
      from: fromAddress(),
      to: email,
      subject: `Your PracticalPodcast code: ${code}`,
      html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto">
        <h2 style="margin:0 0 8px">Your sign-in code</h2>
        <p style="color:#555;margin:0 0 16px">Enter this code to sign in. It expires in 10 minutes.</p>
        <div style="font-size:34px;letter-spacing:10px;font-weight:700;background:#f4f1ea;padding:16px;border-radius:12px;text-align:center">${code}</div>
        <p style="color:#999;font-size:12px;margin-top:16px">If you didn't request this, you can ignore this email.</p>
      </div>`,
    });
    console.log(`[email] Sign-in code emailed to ${email}.`);
  } catch (e) {
    console.warn(`[email] Gmail SMTP failed for ${email}: ${(e as Error).message}`);
    console.log(`[OTP fallback] ${email}  ->  ${code}`);
  }
}

export interface DigestEpisode {
  title: string;
  badgeLabel: string;
  topicNames: string[];
}

/** Daily digest sent after the morning generation run. */
export async function sendDigestEmail(
  email: string,
  dateLabel: string,
  episodes: DigestEpisode[],
  baseUrl: string
): Promise<void> {
  const t = getTransport();
  if (!t) {
    console.log(`[DEV DIGEST] would email ${email}: ${episodes.length} episodes for ${dateLabel}`);
    return;
  }
  const items = episodes
    .map(
      (e) =>
        `<li style="margin:6px 0"><strong>${e.title}</strong> · ${e.badgeLabel} — ${e.topicNames
          .slice(0, 4)
          .join(", ")}</li>`
    )
    .join("");
  try {
    await t.sendMail({
      from: fromAddress(),
      to: email,
      subject: `Your daily podcasts are ready — ${dateLabel}`,
      html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto">
        <h2>Today's podcasts are ready</h2>
        <p style="color:#555">${dateLabel}</p>
        <ul style="padding-left:18px">${items}</ul>
        <p><a href="${baseUrl}/library.html" style="display:inline-block;background:#6d49f5;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">Listen now</a></p>
      </div>`,
    });
  } catch (e) {
    console.warn(`[email] digest to ${email} failed: ${(e as Error).message}`);
  }
}
