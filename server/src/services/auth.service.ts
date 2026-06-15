import type { User } from "@prisma/client";
import { prisma } from "../db/client";
import { generateOtp, hashOtp, safeEqual } from "../lib/crypto";
import { unauthorized } from "../lib/errors";
import { sendOtpEmail } from "../providers/email";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

/** Generate, store, and email a one-time code. Caller is responsible for
 *  rate-limiting. Never reveals whether the email exists. */
export async function requestCode(email: string): Promise<void> {
  // Invalidate any outstanding codes for this email.
  await prisma.otpCode.updateMany({
    where: { email, consumed: false },
    data: { consumed: true },
  });

  const code = generateOtp();
  await prisma.otpCode.create({
    data: {
      email,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  await sendOtpEmail(email, code);
}

/** Verify a code; on success create-or-get the user. Throws 401 otherwise. */
export async function verifyCode(
  email: string,
  code: string
): Promise<{ user: User; needsOnboarding: boolean }> {
  const otp = await prisma.otpCode.findFirst({
    where: { email, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) {
    throw unauthorized("That code is incorrect or expired. Please try again.");
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });
    throw unauthorized("Too many attempts. Request a new code.");
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });

  if (!safeEqual(hashOtp(code), otp.codeHash)) {
    throw unauthorized("That code is incorrect or expired. Please try again.");
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });

  // Create-or-get the user (auto-account creation).
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  return { user, needsOnboarding: user.onboardedAt === null };
}
