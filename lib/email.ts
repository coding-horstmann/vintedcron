import nodemailer from 'nodemailer';
import type { ArbitrageDeal } from '@/types';
import { getEbayResearchUrl } from '@/lib/ebay-api';
import { getAmazonSearchUrl } from '@/lib/amazon-api';

interface EmailConfig {
  from: string;
  to: string;
  gmailAppPassword: string;
}

interface CategoryStat {
  name: string;
  category: string;
  pagesScraped: number;
  itemsFound: number;
}

interface EbayApiStats {
  itemsWithEbayApi: number;
  itemsWithFallbackOnly: number;
  itemsSkippedDueToTimeout: number;
  totalItems: number;
}

/**
 * Bereinigt E-Mail-Adresse von ungültigen Zeichen
 */
function cleanEmail(email: string): string {
  return (email || '')
    .trim()
    .replace(/^["'=\s\r\n]+/, '') // Entferne führende ", ', =, Leerzeichen, Zeilenumbrüche
    .replace(/["'=\s\r\n]+$/, '') // Entferne nachfolgende
    .replace(/[\r\n]/g, '');       // Entferne alle Zeilenumbrüche
}

/**
 * Formatiert einen Preis in Euro
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/**
 * Generiert HTML für die E-Mail mit Arbitrage-Deals
 * Deals werden nach ROI sortiert (höchster ROI zuerst)
 */
function generateEmailHTML(deals: ArbitrageDeal[], scanTime: Date, minRoi: number, categoryStats?: CategoryStat[], ebayApiStats?: EbayApiStats): string {
  // Sortiere Deals nach ROI (absteigend - höchster ROI zuerst)
  const sortedDeals = [...deals].sort((a, b) => b.roi - a.roi);
  
  const dealsHtml = sortedDeals.map(deal => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; vertical-align: top;">
        <div>
          <strong style="color: #1f2937;">${deal.vinted.title}</strong><br/>
          <span style="color: #6b7280; font-size: 12px;">${deal.vinted.condition} • ${deal.vinted.category}</span>
        </div>
      </td>
      <td style="padding: 12px; text-align: right; color: #1f2937; font-weight: 500;">${formatCurrency(deal.vinted.price)}</td>
      <td style="padding: 12px; text-align: right; color: #1f2937; font-weight: 500;">${formatCurrency(deal.ebay.price)}</td>
      <td style="padding: 12px; text-align: center;">
        <span style="background-color: #10b981; color: white; padding: 4px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600;">
          ${deal.roi.toFixed(0)}%
        </span>
      </td>
      <td style="padding: 12px; text-align: center;">
        <a href="${deal.vinted.url}" style="color: #3b82f6; text-decoration: none; margin-right: 8px;">Vinted</a>
        <a href="${deal.ebay.url}" style="color: #8b5cf6; text-decoration: none; margin-right: 8px;">eBay</a>
        <a href="${getEbayResearchUrl(deal.vinted.title, deal.vinted.condition)}" style="color: #ec4899; text-decoration: none; margin-right: 8px;">eBay Research</a>
        <a href="${getAmazonSearchUrl(deal.vinted.title)}" style="color: #ff9900; text-decoration: none;">Amazon Link</a>
      </td>
    </tr>
  `).join('');

  // Kategorie-Statistiken HTML generieren
  let categoryStatsHtml = '';
  if (categoryStats && categoryStats.length > 0) {
    const statsRows = categoryStats.map(stat => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px; color: #1f2937; font-weight: 500;">${stat.name}</td>
        <td style="padding: 12px; color: #6b7280; font-size: 14px;">${stat.category}</td>
        <td style="padding: 12px; text-align: center; color: #3b82f6; font-weight: 600;">${stat.pagesScraped}</td>
        <td style="padding: 12px; text-align: center; color: #10b981; font-weight: 600;">${stat.itemsFound}</td>
      </tr>
    `).join('');
    
    categoryStatsHtml = `
      <div style="padding: 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
        <h2 style="color: #1f2937; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">📊 Scan-Statistiken</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: white; border-bottom: 2px solid #e5e7eb;">
              <th style="padding: 12px; text-align: left; color: #6b7280; font-weight: 600; font-size: 12px; text-transform: uppercase;">Kategorie</th>
              <th style="padding: 12px; text-align: left; color: #6b7280; font-weight: 600; font-size: 12px; text-transform: uppercase;">Typ</th>
              <th style="padding: 12px; text-align: center; color: #6b7280; font-weight: 600; font-size: 12px; text-transform: uppercase;">Seiten</th>
              <th style="padding: 12px; text-align: center; color: #6b7280; font-weight: 600; font-size: 12px; text-transform: uppercase;">Artikel</th>
            </tr>
          </thead>
          <tbody>
            ${statsRows}
          </tbody>
        </table>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
      <div style="max-width: 900px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🎯 VintedCron - Arbitrage Report</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">
            Automatischer Scan vom ${scanTime.toLocaleDateString('de-DE')} um ${scanTime.toLocaleTimeString('de-DE')}
          </p>
        </div>

        <!-- Stats -->
        <div style="display: flex; justify-content: center; gap: 24px; padding: 24px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
          <div style="text-align: center;">
            <div style="font-size: 28px; font-weight: 700; color: #10b981;">${deals.length}</div>
            <div style="font-size: 12px; color: #6b7280;">Deals gefunden</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 28px; font-weight: 700; color: #3b82f6;">≥${minRoi}%</div>
            <div style="font-size: 12px; color: #6b7280;">Min. ROI</div>
          </div>
        </div>

        ${categoryStatsHtml}

        <!-- eBay-API-Statistiken -->
        ${ebayApiStats && ebayApiStats.itemsSkippedDueToTimeout > 0 ? `
          <div style="padding: 24px; background-color: #fef3c7; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb;">
            <h2 style="color: #92400e; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">⚠️ eBay-API-Hinweis</h2>
            <div style="color: #78350f; font-size: 14px; line-height: 1.6;">
              <p style="margin: 0 0 12px 0;">
                <strong>Nicht alle Items konnten mit der eBay-API verarbeitet werden:</strong>
              </p>
              <ul style="margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;">
                  <strong>${ebayApiStats.itemsWithEbayApi}</strong> Items wurden mit eBay-API verarbeitet (mit echten Preisen)
                </li>
                <li style="margin-bottom: 8px;">
                  <strong>${ebayApiStats.itemsWithFallbackOnly}</strong> Items wurden nur mit Fallback-URLs verarbeitet (ohne eBay-Preise)
                </li>
                ${ebayApiStats.itemsSkippedDueToTimeout > 0 ? `
                <li style="margin-bottom: 8px;">
                  <strong>${ebayApiStats.itemsSkippedDueToTimeout}</strong> Items wurden wegen Timeout übersprungen
                </li>
                ` : ''}
              </ul>
              <p style="margin: 12px 0 0 0; font-size: 13px; color: #92400e;">
                <strong>Hinweis:</strong> "Fallback-URLs" bedeutet, dass kein Preis bei eBay gefunden wurde (z.B. Artikel nicht verfügbar oder zu selten). 
                Diese Items haben ROI 0% und werden nicht in dieser E-Mail angezeigt. 
                Items mit eBay-Preis aber ROI &lt; ${minRoi}% werden ebenfalls nicht angezeigt. 
                Bitte überprüfe die Web-App für eine vollständige Übersicht aller gescannten Items.
              </p>
            </div>
          </div>
        ` : ''}

        <!-- Deals Table -->
        <div style="padding: 24px;">
          ${deals.length > 0 ? `
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                  <th style="padding: 12px; text-align: left; color: #6b7280; font-weight: 600; font-size: 12px; text-transform: uppercase;">Artikel</th>
                  <th style="padding: 12px; text-align: right; color: #6b7280; font-weight: 600; font-size: 12px; text-transform: uppercase;">Vinted</th>
                  <th style="padding: 12px; text-align: right; color: #6b7280; font-weight: 600; font-size: 12px; text-transform: uppercase;">eBay</th>
                  <th style="padding: 12px; text-align: center; color: #6b7280; font-weight: 600; font-size: 12px; text-transform: uppercase;">ROI</th>
                  <th style="padding: 12px; text-align: center; color: #6b7280; font-weight: 600; font-size: 12px; text-transform: uppercase;">Links</th>
                </tr>
              </thead>
              <tbody>
                ${dealsHtml}
              </tbody>
            </table>
          ` : `
            <div style="text-align: center; padding: 48px; color: #6b7280;">
              <p style="font-size: 16px;">Keine Deals mit ROI ≥ ${minRoi}% gefunden.</p>
              <p style="font-size: 14px;">Der nächste Scan läuft automatisch in 2 Stunden.</p>
            </div>
          `}
        </div>

        <!-- Footer -->
        <div style="background-color: #1f2937; padding: 16px 24px; text-align: center;">
          <p style="color: #9ca3af; margin: 0; font-size: 12px;">
            VintedCron • Automatischer Scan alle 2 Stunden (8:00 - 21:00 Uhr)
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Sendet E-Mail über Resend API (HTTP-basiert, funktioniert auf Railway)
 */
async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  resendApiKey: string,
  fromEmail?: string
): Promise<void> {
  console.log(`[EMAIL] Sende via Resend API...`);
  
  // Verwende verifizierte Domain oder Fallback auf Test-Absender
  // Format: "Name <email@domain.de>" oder "email@domain.de"
  const from = fromEmail || 'VintedCron <onboarding@resend.dev>';
  
  console.log(`[EMAIL] Absender: ${from}`);
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: from,
      to: [to],
      subject: subject,
      html: html,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Resend API Fehler: ${JSON.stringify(error)}`);
  }

  const result = await response.json();
  console.log(`[EMAIL] Resend erfolgreich: ${result.id}`);
}

/**
 * Sendet E-Mail über Gmail SMTP (Fallback)
 */
async function sendViaGmail(
  from: string,
  to: string,
  subject: string,
  html: string,
  password: string
): Promise<void> {
  console.log(`[EMAIL] Sende via Gmail SMTP...`);
  
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: from,
      pass: password,
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    tls: {
      rejectUnauthorized: false,
    }
  });

  await transporter.sendMail({
      from: `VintedCron <${from}>`,
    to: to,
    subject: subject,
    html: html,
  });
  
  console.log(`[EMAIL] Gmail SMTP erfolgreich`);
}

/**
 * Sendet eine E-Mail mit Arbitrage-Deals
 * Verwendet Resend API (HTTP) wenn RESEND_API_KEY gesetzt, sonst Gmail SMTP
 */
export async function sendArbitrageEmail(
  deals: ArbitrageDeal[],
  config: EmailConfig,
  minRoi: number = 150,
  categoryStats?: CategoryStat[],
  ebayApiStats?: EbayApiStats
): Promise<{ success: boolean; message: string; filteredCount: number }> {
  try {
    // Sicherstellen, dass minRoi eine gültige Zahl ist
    const validMinRoi = isNaN(minRoi) || minRoi <= 0 ? 150 : minRoi;
    
    // Filtere Deals: Zeige NUR Deals mit eBay-Preis > 0 und ROI >= minRoi
    // Sortiere nach ROI (absteigend) für bessere Übersicht
    let filteredDeals = deals
      .filter(deal => deal.ebay.price > 0 && deal.roi >= validMinRoi)
      .sort((a, b) => b.roi - a.roi);
    
    console.log(`[EMAIL] ${filteredDeals.length} Deals mit ROI >= ${validMinRoi}% gefunden (von ${deals.length} total)`);
    
    // Wenn keine Deals mit hohem ROI gefunden wurden, zeige Info
    if (filteredDeals.length === 0) {
      const dealsWithPrice = deals.filter(deal => deal.ebay.price > 0 && deal.roi > 0);
      if (dealsWithPrice.length > 0) {
        const maxRoi = Math.max(...dealsWithPrice.map(d => d.roi));
        console.log(`[EMAIL] Keine Deals mit ROI >= ${validMinRoi}% gefunden. Höchster ROI: ${maxRoi.toFixed(0)}%`);
      }
    }
    
    // Bereinige E-Mail-Adressen
    const cleanFrom = cleanEmail(config.from);
    const cleanTo = cleanEmail(config.to);
    const cleanPassword = (config.gmailAppPassword || '').trim().replace(/[\r\n\s]/g, '');
    
    console.log(`[EMAIL] Sende E-Mail mit ${filteredDeals.length} Deals (von ${deals.length} total, ROI >= ${validMinRoi}%)`);
    console.log(`[EMAIL] TO: "${cleanTo}"`);
    
    // Generiere E-Mail-Content
    const scanTime = new Date();
    const maxRoi = filteredDeals.length > 0 ? Math.max(...filteredDeals.map(d => d.roi)).toFixed(0) : '0';
    const minRoiShown = filteredDeals.length > 0 ? Math.min(...filteredDeals.map(d => d.roi)).toFixed(0) : '0';
    const subject = filteredDeals.length > 0 
      ? `🎯 ${filteredDeals.length} Arbitrage-Deals gefunden (von ${deals.length} total, ROI ${minRoiShown}%-${maxRoi}%)` 
      : `📊 VintedCron Scan: ${deals.length} Deals gefunden, aber keine mit eBay-Preis`;
    const html = generateEmailHTML(filteredDeals, scanTime, validMinRoi, categoryStats, ebayApiStats);

    // Prüfe ob Resend API Key vorhanden
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFromEmail = process.env.RESEND_FROM_EMAIL; // z.B. "VintedHunter <noreply@lax-republic.de>"
    
    if (resendApiKey) {
      // Methode 1: Resend API (HTTP-basiert, funktioniert auf Railway)
      console.log(`[EMAIL] Verwende Resend API (HTTP)`);
      await sendViaResend(cleanTo, subject, html, resendApiKey, resendFromEmail);
    } else if (cleanFrom && cleanPassword) {
      // Methode 2: Gmail SMTP (Fallback, funktioniert nicht auf Railway)
      console.log(`[EMAIL] Verwende Gmail SMTP (Fallback)`);
      console.log(`[EMAIL] HINWEIS: Gmail SMTP funktioniert nicht auf Railway! Setze RESEND_API_KEY für zuverlässigen E-Mail-Versand.`);
      await sendViaGmail(cleanFrom, cleanTo, subject, html, cleanPassword);
    } else {
      throw new Error('Weder RESEND_API_KEY noch Gmail-Credentials konfiguriert');
    }
    
    return {
      success: true,
      message: `E-Mail erfolgreich an ${cleanTo} gesendet`,
      filteredCount: filteredDeals.length
    };
  } catch (error) {
    console.error('[EMAIL] Fehler:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unbekannter E-Mail-Fehler',
      filteredCount: 0
    };
  }
}
