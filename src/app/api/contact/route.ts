import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Everything sensitive lives in server-only env vars (no NEXT_PUBLIC_ prefix),
// so the destination address never reaches the browser.
const TO = process.env.CONTACT_TO_EMAIL;
const SMTP_HOST = process.env.CONTACT_SMTP_HOST;
const SMTP_PORT = Number(process.env.CONTACT_SMTP_PORT || 587);
const SMTP_USER = process.env.CONTACT_SMTP_USER;
const SMTP_PASS = process.env.CONTACT_SMTP_PASS;
const FROM = process.env.CONTACT_FROM_EMAIL || SMTP_USER;

// Minimal spam guard: a few messages per address window, kept in memory.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recentByIp = new Map<string, number[]>();

function isConfigured() {
    return Boolean(TO && SMTP_HOST && SMTP_USER && SMTP_PASS);
}

function isThrottled(ip: string) {
    const now = Date.now();
    const recent = (recentByIp.get(ip) ?? []).filter(t => now - t < WINDOW_MS);
    recentByIp.set(ip, recent);
    return recent.length >= MAX_PER_WINDOW;
}

function recordSend(ip: string) {
    recentByIp.set(ip, [...(recentByIp.get(ip) ?? []), Date.now()]);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
    if (!isConfigured()) {
        return NextResponse.json(
            { error: "Het contactformulier is niet ingesteld. Probeer het later opnieuw." },
            { status: 503 }
        );
    }

    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isThrottled(ip)) {
        return NextResponse.json(
            { error: "Je hebt net een bericht gestuurd. Wacht even voor je er nog een stuurt." },
            { status: 429 }
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
    }

    const { name, replyTo, message } =
        (body as { name?: unknown; replyTo?: unknown; message?: unknown }) ?? {};
    const cleanName = typeof name === "string" ? name.trim().slice(0, 100) : "";
    const cleanReplyTo = typeof replyTo === "string" ? replyTo.trim().slice(0, 200) : "";
    const cleanMessage = typeof message === "string" ? message.trim() : "";

    if (cleanMessage.length === 0 || cleanMessage.length > 2000) {
        return NextResponse.json(
            { error: "Je bericht mag niet leeg zijn en maximaal 2000 tekens bevatten." },
            { status: 400 }
        );
    }
    if (cleanReplyTo && !EMAIL_RE.test(cleanReplyTo)) {
        return NextResponse.json(
            { error: "Dat e-mailadres lijkt niet te kloppen." },
            { status: 400 }
        );
    }

    try {
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_PORT === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
        });

        await transporter.sendMail({
            from: FROM,
            to: TO,
            subject: `Bericht via Ritmetrainer${cleanName ? ` van ${cleanName}` : ""}`,
            text: [
                cleanName ? `Naam: ${cleanName}` : null,
                cleanReplyTo ? `Antwoord naar: ${cleanReplyTo}` : null,
                "",
                cleanMessage,
            ]
                .filter(line => line !== null)
                .join("\n"),
            replyTo: cleanReplyTo || undefined,
        });

        recordSend(ip);
        return NextResponse.json({ ok: true });
    } catch (error) {
        // Logged server-side only; the client gets a generic message so no
        // configuration details ever leak.
        console.error("[contact] sending failed", error);
        return NextResponse.json(
            { error: "Verzenden is mislukt. Probeer het later opnieuw." },
            { status: 500 }
        );
    }
}
