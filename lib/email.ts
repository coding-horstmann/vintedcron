import nodemailer from 'nodemailer';
import type { ArbitrageDeal } from '@/types';
import { getEbayResearchUrl } from '@/lib/ebay-api';

interface EmailConfig {
  from: string;
  to: string;
  gmailAppPassword: string;
}

/**
 * Erstellt einen Nodemailer-Transporter für Gmail
 */
function createTransporter(config: EmailConfig) {
  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true für Port 465, false für andere Ports
    auth: {
      user: config.from,
      pass: config.gmailAppPassword,
    },
    connectionTimeout: 10000, // 10 Sekunden
    greetingTimeout: 10000,
    socketTimeout: 10000,
    // Zusätzliche Optionen für bessere Kompatibilität
    tls: {
      rejectUnauthorized: false
    }
  });
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
 */
function generateEmailHTML(deals: ArbitrageDeal[], scanTime: Date): string {
  const dealsHtml = deals.map(deal => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; vertical-align: top;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="${deal.vinted.imageUrl}" alt="${deal.vinted.title}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb;" />
          <div>
            <strong style="color: #1f2937;">${deal.vinted.title}</strong><br/>
            <span style="color: #6b7280; font-size: 12px;">${deal.vinted.condition} • ${deal.vinted.category}</span>
          </div>
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
        <a href="${getEbayResearchUrl(deal.vinted.title, deal.vinted.condition)}" style="color: #ec4899; text-decoration: none;">Research</a>
      </td>
    </tr>
  `).join('');

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
          <h1 style="color: white; margin: 0; font-size: 24px;">🎯 VintedHunter - Arbitrage Report</h1>
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
            <div style="font-size: 28px; font-weight: 700; color: #3b82f6;">≥150%</div>
            <div style="font-size: 12px; color: #6b7280;">Min. ROI</div>
          </div>
        </div>

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
              <p style="font-size: 16px;">Keine Deals mit ROI ≥ 150% gefunden.</p>
              <p style="font-size: 14px;">Der nächste Scan läuft automatisch in 2 Stunden.</p>
            </div>
          `}
        </div>

        <!-- Footer -->
        <div style="background-color: #1f2937; padding: 16px 24px; text-align: center;">
          <p style="color: #9ca3af; margin: 0; font-size: 12px;">
            VintedHunter Arbitrage Finder • Automatischer Scan alle 2 Stunden (8:00 - 21:00 Uhr)
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Sendet eine E-Mail mit Arbitrage-Deals
 * Nur Deals mit ROI >= minRoi werden einbezogen
 */
export async function sendArbitrageEmail(
  deals: ArbitrageDeal[],
  config: EmailConfig,
  minRoi: number = 150
): Promise<{ success: boolean; message: string; filteredCount: number }> {
  try {
    // Sicherstellen, dass minRoi eine gültige Zahl ist
    const validMinRoi = isNaN(minRoi) || minRoi <= 0 ? 150 : minRoi;
    
    // Filtere Deals nach Min-ROI
    const filteredDeals = deals.filter(deal => deal.roi >= validMinRoi);
    
    console.log(`[EMAIL] Sende E-Mail mit ${filteredDeals.length} Deals (ROI >= ${validMinRoi}%)`);
    
    // Wenn keine Deals den Filter erfüllen, trotzdem E-Mail senden (mit Info)
    const transporter = createTransporter(config);
    const scanTime = new Date();
    
    const mailOptions = {
      from: `VintedHunter <${config.from}>`,
      to: config.to,
      subject: filteredDeals.length > 0 
        ? `🎯 ${filteredDeals.length} Arbitrage-Deals gefunden (ROI ≥${validMinRoi}%)` 
        : `📊 VintedHunter Scan: Keine Deals mit ROI ≥${validMinRoi}%`,
      html: generateEmailHTML(filteredDeals, scanTime),
    };

    // E-Mail mit Timeout senden
    await Promise.race([
      transporter.sendMail(mailOptions),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('E-Mail Timeout nach 15 Sekunden')), 15000)
      )
    ]);
    
    return {
      success: true,
      message: `E-Mail erfolgreich an ${config.to} gesendet`,
      filteredCount: filteredDeals.length
    };
  } catch (error) {
    console.error('E-Mail Fehler:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unbekannter E-Mail-Fehler',
      filteredCount: 0
    };
  }
}

