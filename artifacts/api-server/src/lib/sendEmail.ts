import { Resend } from "resend";
import { htmlToPlainText } from "./htmlToText";

interface ConnectorSettings {
  api_key: string;
  from_email: string;
}

interface ConnectorItem {
  id: string;
  status: string;
  settings: ConnectorSettings;
}

interface ConnectorListResponse {
  items?: ConnectorItem[];
}

async function getResendCredentials(): Promise<{ apiKey: string; fromEmail: string } | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!hostname || !xReplitToken) {
    return null;
  }

  try {
    const rawResp = await fetch(
      "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
      {
        headers: {
          Accept: "application/json",
          "X-Replit-Token": xReplitToken,
        },
      }
    );

    if (!rawResp.ok) {
      console.warn("[sendEmail] Connector API returned status:", rawResp.status);
      return null;
    }

    const json: ConnectorListResponse = (await rawResp.json()) as ConnectorListResponse;
    const item = json?.items?.[0];

    if (!item || !item.settings?.api_key) {
      return null;
    }

    return {
      apiKey: item.settings.api_key,
      fromEmail: item.settings.from_email,
    };
  } catch (err) {
    console.warn("[sendEmail] Could not fetch Resend credentials:", err);
    return null;
  }
}

interface SendEmailOptions {
  to: string;
  toName: string;
  from: string;
  fromName: string;
  subject: string;
  body: string;
  htmlBody?: string;
}

interface SendEmailResult {
  success: boolean;
  error?: string;
  messageId?: string; // Resend message ID for tracking
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const credentials = await getResendCredentials();

  if (!credentials) {
    console.warn(
      "[sendEmail] Resend not connected — email not delivered to:",
      opts.to,
      "Subject:",
      opts.subject
    );
    return { success: false, error: "Email service not configured. Please connect Resend." };
  }

  try {
    const resend = new Resend(credentials.apiKey);

    // Determine HTML and plain text versions
    const htmlContent = opts.htmlBody || opts.body;
    
    // Extract plain text from HTML if needed
    // If the body contains HTML tags, it's likely HTML content that needs plain text extraction
    const isHtml = /<[^>]+>/g.test(htmlContent);
    const plainTextContent = isHtml ? htmlToPlainText(htmlContent) : opts.body;

    // Resend requires a verified sender domain. The connector's from_email takes
    // precedence over the campaign's fromEmail to ensure delivery works out of the box.
    // The sender display name (fromName) from the campaign is preserved.
    const fromAddress = `${opts.fromName} <${credentials.fromEmail}>`;

    const response = await resend.emails.send({
      from: fromAddress,
      to: [opts.to],
      subject: opts.subject,
      text: plainTextContent,
      html: htmlContent,
    });
    
    const { data, error } = response;
    const id = data?.id;
    
    console.log(`[sendEmail] Resend response for ${opts.to}:`, JSON.stringify({ id, error }));

    if (error) {
      console.error("[sendEmail] Resend error:", error);
      return { success: false, error: error.message };
    }

    if (!id) {
      console.error("[sendEmail] No message ID returned from Resend");
      return { success: false, error: "No message ID returned from Resend" };
    }

    console.log(`[sendEmail] Successfully sent email to ${opts.to}, messageId: ${id}`);
    return { success: true, messageId: id };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    console.error("[sendEmail] Error:", error);
    return { success: false, error };
  }
}
