import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import cron from 'node-cron';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
// Railway setzt PORT, verwende diesen explizit
const port = parseInt(process.env.PORT || '3000', 10);

console.log(`Starting server on port ${port} (PORT env: ${process.env.PORT || 'not set'})`);

const app = next({ dev, hostname });
const handle = app.getRequestHandler();

// Funktion um den Cron-API-Endpunkt aufzurufen
async function runCronJob() {
  try {
    const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : `http://localhost:${port}`;
    
    console.log(`[CRON] Starte automatischen Scan via ${baseUrl}/api/cron`);
    
    // Längeres Timeout für lange Scans (30 Minuten)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30 * 60 * 1000);
    
    const response = await fetch(`${baseUrl}/api/cron`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`[CRON] Erfolgreich: ${data.totalDeals} Deals gefunden, ${data.dealsWithMinRoi} mit ROI >= ${data.minRoiFilter}%`);
      if (data.email?.success) {
        console.log(`[CRON] E-Mail gesendet: ${data.email.message}`);
      }
    } else if (data.skipped) {
      console.log(`[CRON] Übersprungen: ${data.message}`);
    } else {
      console.error(`[CRON] Fehler: ${data.error || data.message}`);
    }
  } catch (error) {
    console.error('[CRON] Kritischer Fehler beim Ausführen des Cron-Jobs:', error);
  }
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Server listening on PORT: ${port}`);
    
    // Cron-Job starten: Alle 2 Stunden von 8:00 bis 20:00 Uhr (deutsche Zeit)
    // Format: Minute Stunde Tag Monat Wochentag
    // 0 8,10,12,14,16,18,20 * * * = Jede volle Stunde bei 8, 10, 12, 14, 16, 18, 20 Uhr
    const cronSchedule = '0 8,10,12,14,16,18,20 * * *';
    
    cron.schedule(cronSchedule, () => {
      console.log(`[CRON] Scheduled job triggered at ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}`);
      runCronJob();
    }, {
      timezone: 'Europe/Berlin'
    });
    
    console.log(`> Cron-Job aktiviert: ${cronSchedule} (Europe/Berlin)`);
    console.log(`> Automatische Scans: 8:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00 Uhr`);
  });
});
