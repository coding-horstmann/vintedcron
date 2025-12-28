#!/usr/bin/env node

/**
 * Skript zum Erstellen eines neuen GitHub-Repositories
 * Verwendung: node create-github-repo.js [GITHUB_TOKEN]
 */

import https from 'https';
import { readFileSync } from 'fs';

const REPO_NAME = 'isbnhunt';
const GITHUB_USER = 'coding-horstmann';
const GITHUB_TOKEN = process.argv[2] || process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error('❌ Fehler: GitHub Token erforderlich!');
  console.log('\nVerwendung:');
  console.log('  node create-github-repo.js YOUR_GITHUB_TOKEN');
  console.log('  oder');
  console.log('  GITHUB_TOKEN=your_token node create-github-repo.js');
  console.log('\nToken erstellen: https://github.com/settings/tokens');
  process.exit(1);
}

// Repository-Daten
const repoData = {
  name: REPO_NAME,
  description: 'Ein automatisiertes Tool zum Finden von Arbitrage-Möglichkeiten zwischen Vinted.de und eBay.de',
  private: false,
  auto_init: false,
  license_template: 'mit',
  gitignore_template: 'Node'
};

const postData = JSON.stringify(repoData);

const options = {
  hostname: 'api.github.com',
  path: `/user/repos`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'User-Agent': 'Node.js GitHub API Client',
    'Content-Type': 'application/json',
    'Content-Length': postData.length,
    'Accept': 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }
};

console.log(`🚀 Erstelle Repository "${REPO_NAME}" für ${GITHUB_USER}...`);

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 201) {
      const response = JSON.parse(data);
      console.log('✅ Repository erfolgreich erstellt!');
      console.log(`\n📦 Repository URL: ${response.html_url}`);
      console.log(`🔗 Clone URL: ${response.clone_url}`);
      console.log(`\nNächste Schritte:`);
      console.log(`1. git remote add origin ${response.clone_url}`);
      console.log(`2. git add .`);
      console.log(`3. git commit -m "Initial commit"`);
      console.log(`4. git push -u origin main`);
    } else {
      console.error(`❌ Fehler beim Erstellen des Repositories (Status: ${res.statusCode})`);
      console.error('Antwort:', data);
      
      if (res.statusCode === 401) {
        console.error('\n💡 Hinweis: Der Token ist ungültig oder abgelaufen.');
      } else if (res.statusCode === 422) {
        console.error('\n💡 Hinweis: Das Repository existiert möglicherweise bereits.');
      }
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Fehler bei der Anfrage:', error.message);
});

req.write(postData);
req.end();

