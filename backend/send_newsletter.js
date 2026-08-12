const fs = require('fs');
const https = require('https');
const path = require('path');

// 1. Charger le fichier .env si présent localement
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^"(.*)"$/, '$1');
      if (key) process.env[key] = val;
    }
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL || "https://yyqybbzlcrvwupfbjwtc.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_U9d1sl9kQIbqHH1TX8E2yQ_ZqoWGd28";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

if (!RESEND_API_KEY) {
  console.error("❌ ERREUR : La variable d'environnement RESEND_API_KEY est manquante.");
  process.exit(1);
}

// Charger le fichier newsletter.txt
const newsletterFile = path.join(__dirname, 'newsletter.txt');
if (!fs.existsSync(newsletterFile)) {
  // Créer un modèle par défaut
  fs.writeFileSync(newsletterFile, 
`Mise à jour carréemploie : De nouvelles offres d'emploi disponibles !
Bonjour [Nom],

De nouvelles opportunités professionnelles ont été publiées sur carréemploie.

Visitez notre site internet pour les découvrir et configurer vos alertes : https://carreemploie.com

Bonne chance dans vos recherches,
L'équipe carréemploie`, 'utf8');
  console.log(`📝 Fichier newsletter.txt créé. Rédigez votre email dans ce fichier.`);
}

const content = fs.readFileSync(newsletterFile, 'utf8');
const lines = content.split('\n');
const subject = lines[0].trim();
const bodyTemplate = lines.slice(1).join('\n').trim();

console.log(`📨 Sujet de l'email : "${subject}"`);
console.log(`📄 Contenu de l'email (Modèle) :\n------------------------\n${bodyTemplate}\n------------------------`);

// Fonction helper pour faire une requête HTTPS
function makeRequest(url, method, headers, payload = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: headers
    };
    
    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function sendEmail(email, fullname, subject, bodyText) {
  const personalizedBody = bodyText.replace(/\[Nom\]/g, fullname);
  const formattedHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; line-height: 1.6; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 8px; margin-top: 0;">carréemploie 🌟</h2>
      <div style="white-space: pre-line; font-size: 1rem; color: #444;">${personalizedBody}</div>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="font-size: 11px; color: #999; text-align: center;">Vous recevez cet e-mail car vous êtes inscrit sur carréemploie.com.</p>
    </div>
  `;

  const payload = JSON.stringify({
    from: `carréemploie <${RESEND_FROM_EMAIL}>`,
    to: [email],
    subject: subject,
    html: formattedHtml
  });

  const headers = {
    'Authorization': `Bearer ${RESEND_API_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    const res = await makeRequest('https://api.resend.com/emails', 'POST', headers, payload);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log(` ✅ Email envoyé avec succès à : ${email} (${fullname})`);
      return true;
    } else {
      console.error(` ❌ Échec de l'envoi à ${email} : HTTP ${res.statusCode} - ${res.body}`);
      return false;
    }
  } catch (err) {
    console.error(` ❌ Erreur lors de l'envoi à ${email} :`, err.message);
    return false;
  }
}

async function run() {
  console.log("\n⚡ Récupération des inscrits depuis Supabase...");
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  };
  
  try {
    const res = await makeRequest(`${SUPABASE_URL}/rest/v1/users?select=email,fullname`, 'GET', headers);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`HTTP ${res.statusCode} : ${res.body}`);
    }
    
    const users = JSON.parse(res.body);
    console.log(` 👥 ${users.length} inscrits trouvés en base de données.`);
    
    if (users.length === 0) {
      console.log("ℹ️ Aucun inscrit à qui envoyer l'email.");
      return;
    }
    
    console.log("\n🚀 Lancement de la campagne d'envoi...");
    let sentCount = 0;
    
    for (const user of users) {
      if (!user.email) continue;
      const success = await sendEmail(user.email, user.fullname || "Candidat", subject, bodyTemplate);
      if (success) sentCount++;
      // Attendre 200ms entre les envois pour respecter les limites de taux de Resend (Rate Limits)
      await new Promise(r => setTimeout(r, 200));
    }
    
    console.log(`\n🎉 Campagne terminée ! ${sentCount}/${users.length} e-mails ont été envoyés avec succès.`);
  } catch (err) {
    console.error("❌ Impossible de récupérer les inscrits :", err.message);
  }
}

run();
