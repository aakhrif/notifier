// Dummy-Implementierung für den Email-Service
export async function sendEmail({
  to,
  subject,
  content,
  interval
}: {
  to: string;
  subject: string;
  content: string;
  interval: number;
}): Promise<void> {
  // Hier würde die echte Email-Logik stehen (z.B. via nodemailer, sendgrid, etc.)
  // Für Demo-Zwecke loggen wir nur die Daten
  console.log("Sende Email an:", to);
  console.log("Betreff:", subject);
  console.log("Inhalt:", content);
  console.log("Intervall:", interval, "min");
}
