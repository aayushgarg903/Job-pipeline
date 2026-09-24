"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { OFFICER_COOKIE, checkPasscode, officerCookieOptions, sealOfficer } from "@/lib/auth";
import { take } from "@/lib/ratelimit";

export interface SignInState { error: "invalid" | "wrong" | "disabled" | "slow" | null }

const Input = z.object({
  name: z.string().trim().min(2).max(80),
  passcode: z.string().min(1).max(200),
  next: z.string().regex(/^\/(?!\/)[\w\-/?=&%.]*$/).catch("/state"),
});

export async function officerSignIn(_prev: SignInState, fd: FormData): Promise<SignInState> {
  if (!(await take("signin", 5))) return { error: "slow" };
  const p = Input.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "invalid" };
  if (!process.env.CONSOLE_PASSCODE) return { error: "disabled" };
  if (!checkPasscode(p.data.passcode)) return { error: "wrong" };
  const sealed = sealOfficer(p.data.name);
  if (!sealed) return { error: "disabled" };
  (await cookies()).set(OFFICER_COOKIE, sealed, officerCookieOptions);
  redirect(p.data.next);
}

export async function officerSignOut(): Promise<void> {
  (await cookies()).delete(OFFICER_COOKIE);
  redirect("/");
}
