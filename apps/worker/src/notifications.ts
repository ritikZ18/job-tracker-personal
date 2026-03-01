import type pg from "pg";

interface DiscoveredJobPayload {
  jobId: string;
  title: string;
  company: string;
  location: string | null;
  url: string;
}

interface AlertRow {
  id: string;
  user_id: string;
  name: string;
  keywords: string[];
  email: string | null;
  slack_webhook: string | null;
  enabled: boolean;
}

const RESEND_API = "https://api.resend.com/emails";

function matchesKeywords(title: string, keywords: string[]): boolean {
  const lower = title.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

async function sendEmail(
  to: string,
  alertName: string,
  job: DiscoveredJobPayload,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "alerts@careercrawl.app";
  if (!apiKey) return;

  const subject = `New job match (${alertName}): ${job.title}`;
  const html = `
        <p>A new job matching your <strong>${alertName}</strong> alert was discovered.</p>
        <p><strong>${job.title}</strong> at ${job.company}${job.location ? ` — ${job.location}` : ""}</p>
        <p><a href="${job.url}">View posting</a></p>
    `;

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      console.error(
        "[notifications] Resend failed:",
        res.status,
        await res.text(),
      );
    }
  } catch (err) {
    console.error("[notifications] Resend error:", err);
  }
}

async function sendSlack(
  webhook: string,
  alertName: string,
  job: DiscoveredJobPayload,
): Promise<void> {
  const text = `*New match (${alertName})*: <${job.url}|${job.title}> at ${job.company}${job.location ? ` — ${job.location}` : ""}`;
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error("[notifications] Slack webhook failed:", res.status);
    }
  } catch (err) {
    console.error("[notifications] Slack error:", err);
  }
}

/**
 * Fan out a JOB_DISCOVERED event to alert subscribers whose company owns the job
 * and whose keywords match the job title.
 *
 * Caller passes the company's userId (jobs belong to companies, companies belong to users).
 */
export async function notifyJobDiscovered(
  pool: pg.Pool,
  userId: string,
  job: DiscoveredJobPayload,
): Promise<void> {
  try {
    const { rows } = await pool.query<AlertRow>(
      `SELECT id, user_id, name, keywords, email, slack_webhook, enabled
             FROM user_alerts
             WHERE user_id = $1 AND enabled = true`,
      [userId],
    );

    for (const alert of rows) {
      const keywords = Array.isArray(alert.keywords) ? alert.keywords : [];
      if (keywords.length === 0) continue;
      if (!matchesKeywords(job.title, keywords)) continue;

      if (alert.email) await sendEmail(alert.email, alert.name, job);
      if (alert.slack_webhook)
        await sendSlack(alert.slack_webhook, alert.name, job);
    }
  } catch (err) {
    console.error("[notifications] notifyJobDiscovered error:", err);
  }
}
