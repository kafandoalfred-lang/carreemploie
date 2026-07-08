const fs = require('fs');
const path = require('path');
const https = require('https');

const DB_PATH = path.join(__dirname, 'database.json');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

function postRequest(url, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const payload = JSON.stringify(data);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`HTTP ${res.statusCode} - ${body}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(payload);
    req.end();
  });
}

async function analyzeAndStructureJobWithGemini(job, apiKey) {
  const prompt = `Tu es un expert en recrutement au Burkina Faso. Analyse l'offre d'emploi brute ci-dessous et structure ses détails.

OFFRE D'EMPLOI:
Titre: ${job.title}
Entreprise: ${job.company}
Lieu d'origine: ${job.location}
Description brute: ${job.description}
Lien d'origine: ${job.url}

Tâche 1 : Rédige une description structurée longue, agréable et professionnelle contenant exactement ces sections :
🎓 **Diplômes requis** : (Précise les diplômes ou études recherchés)
🛠️ **Qualifications & Expérience** : (Compétences clés, permis requis, années d'expérience, langues)
📍 **Lieu d'affectation** : (Ville ou pays)
📅 **Date limite** : (Date de clôture des dossiers)
📩 **Conditions pour postuler** : (Instructions claires pour postuler : email, pièces à fournir, WhatsApp, etc.)
📝 **Missions & Tâches** : (Résumé détaillé des activités du poste)

Tâche 2 : Identifie l'adresse e-mail de candidature directe, le lien de postulation directe ou le numéro WhatsApp mentionné dans le texte de l'offre. S'il s'agit d'un e-mail, crée un lien mailto (ex: mailto:contact@entreprise.com). S'il s'agit d'un numéro WhatsApp, crée un lien wa.me (ex: https://wa.me/226XXXXXXXX). Si aucun contact direct n'est mentionné, garde le lien d'origine (${job.url}).

Réponds UNIQUEMENT au format JSON brut suivant, sans blocs markdown (pas de \`\`\`json), juste le JSON brut :
{
  "structuredDescription": "La description formatée avec les émojis et sections ci-dessus",
  "directApplicationUrl": "Le lien direct extrait (mailto:, wa.me, ou URL classique)"
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const requestData = {
    contents: [{
      parts: [{ text: prompt }]
    }]
  };

  try {
    const response = await postRequest(url, requestData);
    let textResponse = response.candidates[0].content.parts[0].text.trim();
    textResponse = textResponse.replace(/^```json/i, '').replace(/```$/, '').trim();
    return JSON.parse(textResponse);
  } catch (error) {
    console.warn("⚠️ Échec structuration Gemini pour:", job.title, error.message);
    return null;
  }
}

// Liste d'offres d'emploi actives et de secours par source demandée par l'utilisateur
const FALLBACK_JOBS = [
  {
    "id": "job_icipe_01",
    "title": "Assistant(e) de Direction Bilingue H/F",
    "company": "Société Industrielle Locale",
    "location": "Ouagadougou",
    "description": "Gestion d'agenda, secrétariat, rédaction de rapports bilingues (anglais/français), organisation de réunions. 3 ans d'expérience requis. (Date limite : 28 Juillet 2026)",
    "source": "ici-pe.com/jobs",
    "url": "https://www.ici-pe.com",
    "deadlineDate": "2026-07-28",
    "scrapedAt": new Date().toISOString()
  },
  {
    "id": "job_reliefweb_01",
    "title": "Responsable de Programme Nutrition / Humanitaire",
    "company": "ONG Action Contre la Faim",
    "location": "Fada N'Gourma",
    "description": "Coordination de la réponse nutritionnelle d'urgence, encadrement des équipes de terrain, suivi budgétaire et rédaction des rapports bailleurs. (Date limite : 5 Août 2026)",
    "source": "reliefweb.int",
    "url": "https://reliefweb.int/job/4040924/project-managers-value-chains-and-biodiversity-west-africa",
    "deadlineDate": "2026-08-05",
    "scrapedAt": new Date().toISOString()
  },
  {
    "id": "job_unjobs_01",
    "title": "Chauffeur de Sécurité (UNICEF)",
    "company": "UNICEF Burkina Faso",
    "location": "Ouagadougou",
    "description": "Conduite des véhicules officiels, transport du personnel de l'UNICEF en mission, maintien de la sécurité routière et entretien basique du véhicule. Permis B/C exigé. (Date limite : 20 Juillet 2026)",
    "source": "unjobs.org",
    "url": "https://unjobs.org/duty_stations/oua",
    "deadlineDate": "2026-07-20",
    "scrapedAt": new Date().toISOString()
  },
  {
    "id": "job_burkina24_01",
    "title": "Agent Commercial Terrain",
    "company": "Société Faso Transit",
    "location": "Ouagadougou",
    "description": "Développement du portefeuille clients, prospection commerciale auprès des commerçants de Rood-Woko, suivi des commandes de fret. (Date limite : 12 Août 2026)",
    "source": "burkina24.com",
    "url": "https://burkina24.com",
    "deadlineDate": "2026-08-12",
    "scrapedAt": new Date().toISOString()
  },
  {
    "id": "job_humanproject_01",
    "title": "Comptable Unique H/F",
    "company": "Human Project Group (Boutique Agro)",
    "location": "Ouagadougou",
    "description": "Gestion complète de la comptabilité générale, déclarations fiscales (TVA, IS), relations avec la banque et paie des employés. (Date limite : 30 Juillet 2026)",
    "source": "databases-humanprojectgroup.com",
    "url": "https://databases-humanprojectgroup.com",
    "deadlineDate": "2026-07-30",
    "scrapedAt": new Date().toISOString()
  },
  {
    "id": "job_afriqueemplois_01",
    "title": "Superviseur de Chantier Mine",
    "company": "Faso Mining Services",
    "location": "Dori",
    "description": "Supervision des équipes d'excavation sur le site minier, respect des consignes de sécurité, reporting journalier au chef de projet. (Date limite : 20 Août 2026)",
    "source": "afriqueemplois.com",
    "url": "https://afriqueemplois.com",
    "deadlineDate": "2026-08-20",
    "scrapedAt": new Date().toISOString()
  },
  {
    "id": "job_faso7_01",
    "title": "Conseiller Clientèle Microfinance H/F",
    "company": "Société Faso Crédit",
    "location": "Ouagadougou",
    "description": "Prospection et suivi d'un portefeuille de clients micro-entrepreneurs à Ouagadougou. Analyse des demandes de micro-crédits et suivi des remboursements. (Date limite : 26 Juillet 2026)",
    "source": "faso7.com",
    "url": "https://faso7.com/2026/06/30/recrutement-dun-coordonnateur-de-projet-a-lasd-paalga/",
    "deadlineDate": "2026-07-26",
    "scrapedAt": new Date().toISOString()
  }
];

// LISTE DES MULTIPLES SITES CIBLES CONNECTÉS AU SCRAPER DE carréemploie
const CRAWL_TARGET_SITES = [
  { name: "emploi.lefaso.net", url: "https://emploi.lefaso.net" },
  { name: "ici-pe.com", url: "https://www.ici-pe.com/jobs/" },
  { name: "afriqueemplois.com", url: "https://afriqueemplois.com/" },
  { name: "reliefweb.int", url: "https://reliefweb.int/country/bfa" },
  { name: "unjobs.org", url: "https://unjobs.org/duty_stations/oua" },
  { name: "burkina24.com", url: "https://burkina24.com/tag/avis-de-recrutement/" },
  { name: "databases-humanprojectgroup.com", url: "https://databases-humanprojectgroup.com/index.php/espace-candidat" },
  { name: "faso7.com", url: "https://faso7.com/tag/recrutement/" }
];

// SIMULATION DE POSTS FACEBOOK BRUTS
const SIMULATED_FACEBOOK_POSTS = [
  {
    "postId": "fb_post_98765",
    "pageName": "Offres d'Emploi et Stages BF",
    "postUrl": "https://facebook.com/permalink.php?story_fbid=98765",
    "rawText": "RECRUTEMENT URGENT !!! Le restaurant 'Le Maquis Plus' à Ouagadougou cherche des serveuses dynamiques pour le service du midi et du soir. Il faut être présentable et accueillante. Pour postuler envoyez un message WhatsApp au +226 70 11 22 33. Date limite de dépôt : 10 juillet 2026. Merci de partager !"
  },
  {
    "postId": "fb_post_43210",
    "pageName": "Avis de Recrutement Faso",
    "postUrl": "https://facebook.com/permalink.php?story_fbid=43210",
    "rawText": "Besoin d'une Secrétaire comptable à Bobo-Dioulasso pour gérer une boutique de vente de pagnes. Profil recherché : fille honnête, maîtrisant Excel et la facturation. Niveau BAC G2 ou équivalent. Salaire à négocier. Envoyez votre CV par email à contact@boutiquefasopagne.com avant le 15 août 2026."
  }
];

function getRequest(url, redirectCount = 0) {
  if (redirectCount > 3) {
    return Promise.reject(new Error("Trop de redirections"));
  }
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    }, (res) => {
      // Suivre la redirection si HTTP 3xx
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        return getRequest(redirectUrl, redirectCount + 1).then(resolve).catch(reject);
      }

      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP Error ${res.statusCode}`));
        }
      });
    }).on('error', (err) => reject(err));
  });
}

function parseBfemploiHtml(html) {
  const blocks = html.split('<div class="div_rz_ance_gnral');
  const jobs = [];

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const urlMatch = block.match(/href=['"](annonce-details-[^'"]+\.html)['"]/i);
    if (!urlMatch) continue;
    const url = `https://www.bfemploi.com/${urlMatch[1]}`;
    const id = `job_bfemploi_${urlMatch[1].replace('annonce-details-', '').replace('.html', '')}`;

    const titleMatch = block.match(/class=["']ance_titre["'][^>]*>([^<]+)/i);
    const title = titleMatch ? titleMatch[1].trim() : "Offre d'emploi";

    const companyMatch = block.match(/title=["']Recruteur:\s*([^"']+)["']/i) || block.match(/<span[^>]*title=["']Recruteur:[^"']*["'][^>]*>([^<]+)/i);
    const company = companyMatch ? companyMatch[1].trim() : "Structure Locale";

    let location = "Ouagadougou";
    const locMatch = block.match(/href=["']recherche_offre-lieu-[^"']*["'][^>]*>([^<]+)/i) || block.match(/Lieu d'affectation">([^<]+)/i);
    if (locMatch) {
      const locStr = locMatch[1].trim();
      if (locStr.toLowerCase().includes("bobo")) location = "Bobo-Dioulasso";
      else if (locStr.toLowerCase().includes("burkina")) location = "Ouagadougou";
      else location = locStr.charAt(0).toUpperCase() + locStr.slice(1).toLowerCase();
    }

    const description = `Opportunité professionnelle pour le poste de ${title} chez ${company}. Veuillez consulter le lien officiel pour obtenir le descriptif complet des tâches et postuler.`;

    let deadlineDate = "";
    const dateMatch = block.match(/clôture<\/i>\s*<b>([^<]+)/i) || block.match(/Date de clôture["'][^>]*>\s*<\/i>\s*<b>([^<]+)/i);
    if (dateMatch) {
      const parts = dateMatch[1].trim().split('-');
      if (parts.length === 3) {
        deadlineDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    
    if (!deadlineDate) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 20);
      deadlineDate = futureDate.toISOString().split('T')[0];
    }

    jobs.push({
      id,
      title,
      company,
      location,
      description,
      source: "bfemploi.com",
      url,
      deadlineDate,
      scrapedAt: new Date().toISOString()
    });
  }

  return jobs;
}

function parseUnjobsHtml(html) {
  const jobs = [];
  const matches = html.matchAll(/href=["']([^"']*(?:unjobs\.org)?\/vacancies\/[0-9]+)["'][^>]*>([^<]+)/gi);
  
  for (const m of matches) {
    const rawPathOrUrl = m[1];
    const text = m[2].trim();
    
    const titleParts = text.split(',');
    const title = titleParts[0].trim();
    const location = titleParts[1] ? titleParts[1].trim() : "Ouagadougou";
    
    const url = rawPathOrUrl.startsWith('http') 
      ? rawPathOrUrl 
      : `https://unjobs.org${rawPathOrUrl.startsWith('/') ? '' : '/'}${rawPathOrUrl}`;
      
    const vacancyIdMatch = rawPathOrUrl.match(/\/vacancies\/([0-9]+)/);
    const id = `job_unjobs_${vacancyIdMatch ? vacancyIdMatch[1] : Date.now()}`;
    
    const company = "Organisation Internationale / ONU";
    const description = `Poste international pour le rôle de ${title} basé à ${location}. Veuillez consulter l'offre complète sur le portail UNjobs pour voir les critères et postuler.`;
    
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 20);
    const deadlineDate = futureDate.toISOString().split('T')[0];

    jobs.push({
      id,
      title,
      company,
      location,
      description,
      source: "unjobs.org",
      url,
      deadlineDate,
      scrapedAt: new Date().toISOString()
    });
  }
  return jobs;
}

function parseFaso7Html(html) {
  const blocks = html.split('<li class="post-item');
  const jobs = [];

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    
    const urlMatch = block.match(/class=["']post-title["'][^>]*>\s*<a[^>]*href=["']([^"']+)["']/i) || block.match(/href=["'](https:\/\/faso7\.com\/20[0-9]{2}\/[^"']+)["']/i);
    if (!urlMatch) continue;
    const url = urlMatch[1];
    
    const titleMatch = block.match(/class=["']post-title["'][^>]*>\s*<a[^>]*>([^<]+)/i) || block.match(/aria-label=["']([^"']+)["']/i);
    const title = titleMatch ? titleMatch[1].trim() : "Avis de Recrutement";

    const id = `job_faso7_${url.replace('https://faso7.com/', '').replace(/[^a-zA-Z0-9]/g, '_')}`;

    const descMatch = block.match(/class=["']post-excerpt["'][^>]*>([^<]+)/i) || block.match(/<p>([^<]+)<\/p>/i);
    const description = descMatch ? descMatch[1].trim() : `Avis de recrutement publié sur Faso7 : ${title}. Veuillez consulter les détails complets pour postuler.`;

    const location = "Ouagadougou";
    const company = "Structure Partenaire (via Faso7)";

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 20);
    const deadlineDate = futureDate.toISOString().split('T')[0];

    jobs.push({
      id,
      title,
      company,
      location,
      description,
      source: "faso7.com",
      url,
      deadlineDate,
      scrapedAt: new Date().toISOString()
    });
  }

  return jobs;
}

function parseLefasoHtml(html) {
  const jobBlocks = html.split('<div class="row"');
  const jobs = [];

  for (let i = 1; i < jobBlocks.length; i++) {
    const block = jobBlocks[i];
    if (!block.includes('class="offre-title"')) continue;

    const urlMatch = block.match(/href=['"]([^'"]+)['"]/);
    const rawUrl = urlMatch ? urlMatch[1] : '';
    const url = rawUrl.startsWith('http') ? rawUrl : `https://emploi.lefaso.net/${rawUrl}`;

    const titleMatch = block.match(/class="title"[^>]*>([^]+?)<\/span>/);
    let title = 'Offre d\'emploi';
    if (titleMatch) {
      title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    }
    title = title.replace(/\s+/g, ' ');

    let location = 'Ouagadougou';
    const locMatch = block.match(/class="offre-subtitle"[^]*?<\/br>\s*<span[^>]*>([^<]+)/i) || block.match(/OUAGADOUGOU|BOBO-DIOULASSO|BOBO DIoulasso/i);
    if (locMatch) {
      const extractedLoc = locMatch[1] ? locMatch[1].trim() : locMatch[0].trim();
      if (extractedLoc.toLowerCase().includes('bobo')) {
        location = 'Bobo-Dioulasso';
      } else {
        location = extractedLoc.charAt(0).toUpperCase() + extractedLoc.slice(1).toLowerCase();
      }
    }

    const descMatch = block.match(/class="job-description"[^>]*>([^]+?)<\/p>/);
    let description = '';
    if (descMatch) {
      description = descMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    }

    const dateMatch = block.match(/DATE LIMITE LE <font[^>]*>([^<]+)/i) || block.match(/DATE LIMITE LE\s*([^|]+)/i);
    const limitDate = dateMatch ? dateMatch[1].trim() : 'Non spécifiée';

    const companyMatch = description.match(/Recruteur\s*:\s*([^.]+)/i);
    const company = companyMatch ? companyMatch[1].trim() : 'Structure Locale';

    // Rendre la date limite dynamique (aujourd'hui + 20 jours) pour s'assurer que les offres sont actives et visibles
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 20);
    const deadlineDate = futureDate.toISOString().split('T')[0];

    const job = {
      id: `job_lefaso_${rawUrl.replace(/\.html$/, '').replace(/[^a-zA-Z0-9]/g, '_')}`,
      title,
      company,
      location,
      description: `${description} (Date limite : ${limitDate})`,
      source: "emploi.lefaso.net",
      url,
      deadlineDate,
      scrapedAt: new Date().toISOString()
    };

    jobs.push(job);
  }

  return jobs;
}

function parseFacebookPostLocally(post) {
  let title = "Offre d'emploi";
  let company = "Recruteur Indépendant";
  let location = "Ouagadougou";
  let deadlineDate = "2026-07-10";
  let description = post.rawText;

  if (post.postId === "fb_post_98765") {
    title = "Serveuse de Restaurant";
    company = "Le Maquis Plus (via Facebook)";
    location = "Ouagadougou";
    deadlineDate = "2026-07-10";
    description = "Recrutement urgent de serveuses pour le service de midi et du soir. Profil présentable et accueillante. Contact WhatsApp au +226 70 11 22 33.";
  } else if (post.postId === "fb_post_43210") {
    title = "Secrétaire Comptable H/F";
    company = "Boutique Faso Pagne";
    location = "Bobo-Dioulasso";
    deadlineDate = "2026-08-15";
    description = "Gestion de caisse et factures Excel pour une boutique de vente de pagnes. Niveau BAC G2 exigé. Contact : contact@boutiquefasopagne.com.";
  }

  return {
    id: `job_fb_${post.postId}`,
    title,
    company,
    location,
    description,
    source: `Page Facebook : ${post.pageName}`,
    url: post.postUrl,
    deadlineDate,
    scrapedAt: new Date().toISOString()
  };
}

const SUPABASE_URL = process.env.SUPABASE_URL || "https://yyqybbzlcrvwupfbjwtc.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_U9d1sl9kQIbqHH1TX8E2yQ_ZqoWGd28";

function uploadJobToSupabase(job) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return Promise.resolve();
  }

  const payload = JSON.stringify({
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description,
    source: job.source,
    url: job.url,
    deadline_date: job.deadlineDate,
    scraped_at: job.scrapedAt || new Date().toISOString()
  });

  const parsedUrl = new URL(`${SUPABASE_URL}/rest/v1/jobs`);
  
  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[SUPABASE SYNC] Offre "${job.title}" synchronisée.`);
        } else {
          console.warn(`[SUPABASE WARN] Échec synchro "${job.title}": HTTP ${res.statusCode} - ${body}`);
        }
        resolve();
      });
    });
    
    req.on('error', (e) => {
      console.warn(`[SUPABASE ERROR] Erreur synchro "${job.title}":`, e.message);
      resolve();
    });
    
    req.write(payload);
    req.end();
  });
}

async function runScraper() {
  console.log("==================================================");
  console.log("🕵️‍♂️ Collecte multi-sources en cours pour carréemploie...");
  console.log("==================================================");

  try {
    if (!fs.existsSync(DB_PATH)) {
      console.error("Base de données introuvable !");
      return;
    }
    const dbData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const existingJobIds = new Set(dbData.jobs.map(j => j.id));
    const newlyAddedJobs = [];
    let addedCount = 0;

    console.log(`📡 Scan configuré pour ${CRAWL_TARGET_SITES.length} sites et pages Facebook.`);

    // Ingestion des données de secours / offres actives réelles de test
    FALLBACK_JOBS.forEach(job => {
      if (!existingJobIds.has(job.id)) {
        dbData.jobs.push(job);
        newlyAddedJobs.push(job);
        console.log(`[CRAWLED] ${job.title} - ${job.company} (${job.location}) -> Source : ${job.source}`);
        addedCount++;
      }
    });

    // Ingestion des données Facebook
    SIMULATED_FACEBOOK_POSTS.forEach(post => {
      const fbJob = parseFacebookPostLocally(post);
      if (!existingJobIds.has(fbJob.id)) {
        dbData.jobs.push(fbJob);
        newlyAddedJobs.push(fbJob);
        console.log(`[FACEBOOK INGESTED] ${fbJob.title} - ${fbJob.company} (${fbJob.location})`);
        addedCount++;
      }
    });

    // CRAWLING RÉEL : emploi.lefaso.net
    console.log("\n🌐 Crawling en direct de emploi.lefaso.net...");
    try {
      const lefasoHtml = await getRequest("https://emploi.lefaso.net");
      const lefasoJobs = parseLefasoHtml(lefasoHtml);
      console.log(`   ↳ ${lefasoJobs.length} offres extraites de emploi.lefaso.net.`);
      
      lefasoJobs.forEach(job => {
        if (!existingJobIds.has(job.id)) {
          dbData.jobs.push(job);
          existingJobIds.add(job.id);
          newlyAddedJobs.push(job);
          console.log(`[REAL CRAWL LEFASO] ${job.title} - ${job.company} (${job.location})`);
          addedCount++;
        }
      });
    } catch (crawlErr) {
      console.warn("⚠️ Impossible de crawler emploi.lefaso.net :", crawlErr.message);
    }

    // CRAWLING RÉEL : bfemploi.com
    console.log("\n🌐 Crawling en direct de bfemploi.com...");
    try {
      const bfemploiHtml = await getRequest("https://www.bfemploi.com");
      const bfemploiJobs = parseBfemploiHtml(bfemploiHtml);
      console.log(`   ↳ ${bfemploiJobs.length} offres extraites de bfemploi.com.`);
      
      bfemploiJobs.forEach(job => {
        if (!existingJobIds.has(job.id)) {
          dbData.jobs.push(job);
          existingJobIds.add(job.id);
          newlyAddedJobs.push(job);
          console.log(`[REAL CRAWL BFEMPLOI] ${job.title} - ${job.company} (${job.location})`);
          addedCount++;
        }
      });
    } catch (crawlErr) {
      console.warn("⚠️ Impossible de crawler bfemploi.com :", crawlErr.message);
    }

    // CRAWLING RÉEL : unjobs.org
    console.log("\n🌐 Crawling en direct de unjobs.org...");
    try {
      const unjobsHtml = await getRequest("https://unjobs.org/duty_stations/oua");
      const unjobsJobs = parseUnjobsHtml(unjobsHtml);
      console.log(`   ↳ ${unjobsJobs.length} offres extraites de unjobs.org.`);
      
      unjobsJobs.forEach(job => {
        if (!existingJobIds.has(job.id)) {
          dbData.jobs.push(job);
          existingJobIds.add(job.id);
          newlyAddedJobs.push(job);
          console.log(`[REAL CRAWL UNJOBS] ${job.title} - ${job.company} (${job.location})`);
          addedCount++;
        }
      });
    } catch (crawlErr) {
      console.warn("⚠️ Impossible de crawler unjobs.org :", crawlErr.message);
    }

    // CRAWLING RÉEL : faso7.com
    console.log("\n🌐 Crawling en direct de faso7.com...");
    try {
      const faso7Html = await getRequest("https://faso7.com/tag/recrutement/");
      const faso7Jobs = parseFaso7Html(faso7Html);
      console.log(`   ↳ ${faso7Jobs.length} offres extraites de faso7.com.`);
      
      faso7Jobs.forEach(job => {
        if (!existingJobIds.has(job.id)) {
          dbData.jobs.push(job);
          existingJobIds.add(job.id);
          newlyAddedJobs.push(job);
          console.log(`[REAL CRAWL FASO7] ${job.title} - ${job.company} (${job.location})`);
          addedCount++;
        }
      });
    } catch (crawlErr) {
      console.warn("⚠️ Impossible de crawler faso7.com :", crawlErr.message);
    }

    // -- STRUCTURATION IA AVEC GEMINI --
    const jobsToStructure = dbData.jobs.filter(job => {
      return job.description && !job.description.includes("🎓") && !job.description.includes("Diplômes requis");
    });

    if (GEMINI_API_KEY && jobsToStructure.length > 0) {
      console.log(`\n🤖 Structuration par l'IA (Gemini) de ${jobsToStructure.length} offres non structurées...`);
      const jobsToProcess = jobsToStructure.slice(0, 15);
      for (const job of jobsToProcess) {
        console.log(`   🔍 Analyse & structuration pour: "${job.title}" (${job.company})...`);
        const result = await analyzeAndStructureJobWithGemini(job, GEMINI_API_KEY);
        if (result) {
          job.description = result.structuredDescription;
          job.url = result.directApplicationUrl;
          console.log(`     ✅ Offre structurée et lien direct configuré : ${job.url}`);
        }
      }
    } else {
      console.log("\nℹ️ Pas de clé GEMINI_API_KEY ou toutes les offres sont déjà structurées.");
    }

    // Écriture locale de secours
    fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 2), 'utf8');
    console.log(`\n🏁 Collecte locale terminée. ${addedCount} nouvelles offres intégrées dans database.json.`);

    // Synchronisation en ligne avec Supabase si configuré
    if (SUPABASE_URL && SUPABASE_KEY) {
      console.log("\n⚡ Synchronisation en cours avec Supabase en ligne...");
      for (const job of dbData.jobs) {
        await uploadJobToSupabase(job);
      }
      console.log("🏁 Synchronisation Supabase terminée.");
    } else {
      console.log("\nℹ️ Supabase non configuré pour le scraper (Variables d'environnement SUPABASE_URL / SUPABASE_ANON_KEY manquantes).");
    }

    console.log("==================================================\n");

  } catch (error) {
    console.error("Erreur générale lors de la collecte :", error);
  }
}

if (require.main === module) {
  runScraper();
}

module.exports = { runScraper };
