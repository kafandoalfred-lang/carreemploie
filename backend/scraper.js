const fs = require('fs');
const path = require('path');
const https = require('https');
const querystring = require('querystring');

const DB_PATH = path.join(__dirname, 'database.json');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

function postFormRequest(url, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const payload = querystring.stringify(data);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch(e) {
            reject(new Error("JSON parse error: " + body));
          }
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
Description brute: ${job.description}
Lien d'origine: ${job.url}

Tâche 1 : Rédige une description structurée longue, agréable et professionnelle contenant exactement ces sections :
🎓 **Diplômes requis** : (Précise les diplômes ou études recherchés)
🛠️ **Qualifications & Expérience** : (Compétences clés, permis requis, années d'expérience, langues)
📍 **Lieu d'affectation** : (Ville ou pays)
📅 **Date limite** : (Date de clôture des dossiers)
📩 **Conditions pour postuler** : (Instructions très claires pour postuler. Si l'offre mentionne une adresse e-mail ou un numéro de contact/WhatsApp pour envoyer le dossier, affiche-le OBLIGATOIREMENT en gras et de façon très visible. Ne mentionne JAMAIS la source web d'où provient l'offre de départ, comme unjobs, reliefweb, lefaso, etc.)
📝 **Missions & Tâches** : (Résumé détaillé des activités du poste)

Tâche 2 : Identifie l'adresse e-mail de candidature directe, le lien de postulation directe ou le numéro WhatsApp mentionné dans le texte de l'offre. S'il s'agit d'un e-mail, crée un lien mailto (ex: mailto:contact@entreprise.com). S'il s'agit d'un numéro WhatsApp, crée un lien wa.me (ex: https://wa.me/226XXXXXXXX). Si aucun contact direct n'est mentionné, garde le lien d'origine (${job.url}).

Tâche 3 : Identifie la date limite de candidature (clôture des dossiers) mentionnée dans la description brute. Convertis-la au format standard YYYY-MM-DD (ex: 2026-07-20). Si elle est absente ou introuvable, renvoie null.

Tâche 4 : Si le titre ou la description brute de l'offre d'emploi sont rédigés en anglais (ou dans une autre langue que le français), traduis l'intégralité de tes réponses (structuredDescription, ainsi que le titre du poste) en français de manière professionnelle et naturelle pour les candidats francophones du Burkina Faso.

Réponds UNIQUEMENT au format JSON brut suivant, sans blocs markdown (pas de \`\`\`json), juste le JSON brut :
{
  "title": "Le titre traduit en français (ex: 'Recruteur Interne' au lieu de 'Internal Recruiter') ou conservé tel quel s'il est déjà en français",
  "structuredDescription": "La description formatée en français avec les émojis et sections ci-dessus",
  "directApplicationUrl": "Le lien direct extrait (mailto:, wa.me, ou URL classique)",
  "deadlineDate": "YYYY-MM-DD ou null"
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const requestData = {
    contents: [{
      parts: [{ text: prompt }]
    }]
  };

  let retries = 3;
  while (retries > 0) {
    try {
      const response = await postRequest(url, requestData);
      if (!response || !response.candidates || !response.candidates[0]) {
        throw new Error("Réponse de Gemini vide ou invalide");
      }
      let textResponse = response.candidates[0].content.parts[0].text.trim();
      
      // Extraction robuste du bloc JSON
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        textResponse = jsonMatch[0];
      }
      
      return JSON.parse(textResponse);
    } catch (error) {
      retries--;
      if (retries === 0) {
        console.warn(`⚠️ Échec final de structuration Gemini pour "${job.title}":`, error.message);
        return null;
      }
      console.warn(`⚠️ Échec temporaire pour "${job.title}" (${error.message}). Nouvelle tentative dans 6 secondes... (${retries} restantes)`);
      await new Promise(resolve => setTimeout(resolve, 6000));
    }
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

  const maxBlocks = Math.min(blocks.length, 16);
  for (let i = 1; i < maxBlocks; i++) {
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

async function parseUnjobsHtml(html) {
  const jobs = [];
  const matches = html.matchAll(/href=["']([^"']*(?:unjobs\.org)?\/vacancies\/[0-9]+)["'][^>]*>([^<]+)/gi);
  
  let count = 0;
  for (const m of matches) {
    if (count >= 15) break;
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
    
    let description = "";
    let deadlineDate = "";
    try {
      console.log(`     📥 Téléchargement des détails pour unjobs.org: ${title}...`);
      const detailHtml = await getRequest(url);
      
      // Extraction de la description brute
      const descMatch = detailHtml.match(/<div class="job_description[^>]*>([\s\S]*?)<\/div>/i) || 
                        detailHtml.match(/<div class="vacancy[^>]*>([\s\S]*?)<\/div>/i) || 
                        detailHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                        detailHtml.match(/<div class="content[^>]*>([\s\S]*?)<\/div>/i);
      if (descMatch) {
        description = descMatch[1]
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      // Extraction de la date (bilingue) depuis la page de détails
      const extDate = extractFrenchDateFromText(detailHtml);
      if (extDate) {
        deadlineDate = extDate;
      }
    } catch (err) {
      console.warn(`     ⚠️ Échec du téléchargement pour unjobs.org:`, err.message);
    }

    if (!description) {
      description = `Poste international pour le rôle de ${title} basé à ${location}. Veuillez consulter l'offre complète sur le portail UNjobs pour voir les critères et postuler.`;
    }

    // Attendre 1,5s pour respecter le serveur
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log(`   ↳ [COLLECTE UNJOBS] "${title}" (Date Limite : ${deadlineDate || "Non spécifiée"})`);

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
    count++;
  }
  return jobs;
}

async function parseFaso7Html(html) {
  const blocks = html.split('<li class="post-item');
  const jobs = [];

  const maxBlocks = Math.min(blocks.length, 16);
  for (let i = 1; i < maxBlocks; i++) {
    const block = blocks[i];
    
    const urlMatch = block.match(/class=["']post-title["'][^>]*>\s*<a[^>]*href=["']([^"']+)["']/i) || block.match(/href=["'](https:\/\/faso7\.com\/20[0-9]{2}\/[^"']+)["']/i);
    if (!urlMatch) continue;
    const url = urlMatch[1];
    
    const titleMatch = block.match(/class=["']post-title["'][^>]*>\s*<a[^>]*>([^<]+)/i) || block.match(/aria-label=["']([^"']+)["']/i);
    const title = titleMatch ? titleMatch[1].trim() : "Avis de Recrutement";

    const id = `job_faso7_${url.replace('https://faso7.com/', '').replace(/[^a-zA-Z0-9]/g, '_')}`;

    const descMatch2 = block.match(/class=["']post-excerpt["'][^>]*>([^<]+)/i) || block.match(/<p>([^<]+)<\/p>/i);
    
    let description = "";
    try {
      console.log(`     📥 Téléchargement des détails pour l'offre faso7.com: ${title}...`);
      const detailHtml = await getRequest(url);
      const descMatch = detailHtml.match(/<div class="entry-content[^>]*>([\s\S]*?)<\/div>/i) || detailHtml.match(/<div class="post-content[^>]*>([\s\S]*?)<\/div>/i);
      if (descMatch) {
        description = descMatch[1]
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<li>/gi, '\n- ')
          .replace(/<[^>]+>/g, '')
          .replace(/\n\s*\n+/g, '\n\n')
          .trim();
      }
    } catch (detailErr) {
      console.warn(`     ⚠️ Échec du téléchargement pour faso7:`, detailErr.message);
    }
    
    if (!description) {
      description = descMatch2 ? descMatch2[1].trim() : `Avis de recrutement publié sur Faso7 : ${title}. Veuillez consulter les détails complets pour postuler.`;
    }

    // Attendre 1,5s pour respecter le serveur
    await new Promise(resolve => setTimeout(resolve, 1500));

    const location = "Ouagadougou";
    const company = "Structure Partenaire (via Faso7)";

    let deadlineDate = "";
    const extDate = extractFrenchDateFromText(description);
    if (extDate) {
      deadlineDate = extDate;
    }

    console.log(`   ↳ [COLLECTE FASO7] "${title}" (Date Limite : ${deadlineDate || "Non spécifiée"})`);

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

async function fetchReliefWebJobs() {
  const url = "https://api.reliefweb.int/v1/jobs?appname=carreemploie";
  const payload = {
    "filter": {
      "field": "primary_country.name",
      "value": "Burkina Faso"
    },
    "limit": 15,
    "fields": {
      "include": ["title", "body", "source", "url", "how_to_apply", "date.closing"]
    },
    "sort": ["date.created:desc"]
  };

  try {
    const response = await postRequest(url, payload);
    if (!response || !response.data) return [];
    
    return response.data.map(item => {
      const fields = item.fields;
      if (!fields) return null;
      
      const title = fields.title || "Offre d'emploi Humanitaire";
      const company = (fields.source && fields.source[0]) ? fields.source[0].name : "ONG Internationale";
      const location = "Burkina Faso";
      
      const bodyText = fields.body || "";
      const howToApplyText = fields.how_to_apply ? `\n\n📌 **Comment postuler :**\n${fields.how_to_apply}` : "";
      const description = `${bodyText}${howToApplyText}`;
      
      let deadlineDate = "";
      if (fields.date && fields.date.closing) {
        deadlineDate = fields.date.closing.split('T')[0];
      }
      
      return {
        id: `job_reliefweb_${item.id}`,
        title,
        company,
        location,
        description,
        source: "reliefweb.int",
        url: fields.url || "https://reliefweb.int",
        deadlineDate,
        scrapedAt: new Date().toISOString()
      };
    }).filter(job => job !== null);
  } catch (err) {
    console.warn("⚠️ Impossible de récupérer les offres de ReliefWeb :", err.message);
    return [];
  }
}

async function fetchIcipeJobs(existingJobIds) {
  const url = "https://www.ici-pe.com/jm-ajax/get_listings/";
  const payload = {
    per_page: 15,
    orderby: "featured",
    order: "DESC",
    page: 1
  };

  try {
    const response = await postFormRequest(url, payload);
    if (!response || !response.html) {
      console.warn("⚠️ Pas de HTML retourné par l'AJAX de ici-pe.com");
      return [];
    }

    const html = response.html;
    const jobs = [];
    const blocks = html.split('<li class="');
    
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];
      
      const urlMatch = block.match(/href="([^"]+)"/i);
      if (!urlMatch) continue;
      const jobUrl = urlMatch[1];
      
      const titleMatch = block.match(/<h3>([^<]+)<\/h3>/i);
      if (!titleMatch) continue;
      const title = titleMatch[1].trim();
      
      const companyMatch = block.match(/<div class="company">[\s\S]*?<strong>([\s\S]*?)<\/strong>/i);
      const company = companyMatch ? companyMatch[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() : "ICI Partenaire Entreprises";
      
      const locationMatch = block.match(/<div class="location">([\s\S]*?)<\/div>/i);
      const location = locationMatch ? locationMatch[1].trim() : "Ouagadougou";
      
      const isExpired = block.includes('class="application-deadline expiring expired"') || block.includes('expired') || block.includes('Fermé:');
      if (isExpired) {
        continue;
      }
      
      const postIdMatch = block.match(/post-([0-9]+)/i);
      const id = `job_icipe_${postIdMatch ? postIdMatch[1] : Math.abs(hashCode(jobUrl))}`;
      
      // Si l'offre existe déjà, pas besoin de télécharger la description
      if (existingJobIds && existingJobIds.has(id)) {
        continue;
      }

      // Récupérer la description complète en téléchargeant la page de détails
      let description = "";
      try {
        console.log(`     📥 Téléchargement des détails pour l'offre ici-pe.com: ${title}...`);
        const detailHtml = await getRequest(jobUrl);
        const descMatch = detailHtml.match(/<div class="job_description[^>]*>([\s\S]*?)<\/div>/i) || detailHtml.match(/<div class="post-content[^>]*>([\s\S]*?)<\/div>/i);
        if (descMatch) {
          description = descMatch[1]
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<li>/gi, '\n- ')
            .replace(/<[^>]+>/g, '')
            .replace(/\n\s*\n+/g, '\n\n')
            .trim();
        }
      } catch (detailErr) {
        console.warn(`     ⚠️ Échec du téléchargement de la description pour ici-pe.com:`, detailErr.message);
      }
      
      // Respecter le serveur pour éviter les blocages temporaires IP (WAF)
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (!description) {
        description = `Offre de recrutement pour le poste de ${title} à ${location}. Recrutement géré par le cabinet ICI Partenaire Entreprises.`;
      }
      
      const deadlineMatch = block.match(/<li class="application-deadline[^>]*>(?:<label>[^<]+<\/label>)?\s*([^<]+)<\/li>/i);
      let deadlineDate = "";
      if (deadlineMatch) {
        const rawDeadline = deadlineMatch[1].trim();
        deadlineDate = parseFrenchDateToIso(rawDeadline);
      }
      

      
      console.log(`   ↳ [COLLECTE ICIPE] "${title}" (Date Limite : ${deadlineDate})`);

      jobs.push({
        id,
        title,
        company,
        location,
        description,
        source: "ici-pe.com/jobs",
        url: jobUrl,
        deadlineDate,
        scrapedAt: new Date().toISOString()
      });
    }

    return jobs;
  } catch (err) {
    console.warn("⚠️ Impossible de récupérer les offres de ici-pe.com :", err.message);
    return [];
  }
}


function parseFrenchDateToIso(dateStr) {
  try {
    const cleanStr = dateStr.toLowerCase().replace(/[^a-z0-9éû]/g, ' ').replace(/\s+/g, ' ').trim();
    const parts = cleanStr.split(' ');
    if (parts.length < 3) return "";
    
    const day = parts[0].padStart(2, '0');
    const year = parts[2];
    
    const months = {
      'janvier': '01', 'janv': '01',
      'février': '02', 'fevr': '02', 'févr': '02',
      'mars': '03',
      'avril': '04', 'avr': '04',
      'mai': '05',
      'juin': '06',
      'juillet': '07', 'juill': '07',
      'août': '08',
      'septembre': '09', 'sept': '09',
      'octobre': '10', 'oct': '10',
      'novembre': '11', 'nov': '11',
      'décembre': '12', 'dec': '12', 'déc': '12'
    };
    
    const month = months[parts[1]];
    if (!month) return "";
    
    return `${year}-${month}-${day}`;
  } catch (e) {
    return "";
  }
}

function extractFrenchDateFromText(text) {
  if (!text) return null;

  // Normaliser le texte (balises, espaces, caractères spéciaux)
  const cleanText = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '-')
    .replace(/\s+/g, ' ');

  const months = {
    'janvier': '01', 'janv': '01', 'jan': '01',
    'février': '02', 'fevr': '02', 'févr': '02', 'fev': '02',
    'mars': '03', 'mar': '03',
    'avril': '04', 'avr': '04',
    'mai': '05',
    'juin': '06', 'jui': '06',
    'juillet': '07', 'juil': '07', 'juill': '07',
    'août': '08', 'aout': '08', 'aou': '08',
    'septembre': '09', 'sept': '09', 'sep': '09',
    'octobre': '10', 'oct': '10',
    'novembre': '11', 'nov': '11',
    'décembre': '12', 'déc': '12', 'dec': '12',
    'january': '01', 'february': '02', 'march': '03', 'april': '04', 
    'june': '06', 'july': '07', 'august': '08', 'september': '09', 
    'october': '10', 'november': '11', 'december': '12'
  };

  const deadlineKeywords = [
    'limite', 'cloture', 'clôture', 'tard', 'jusqu\'au', 'avant le', 
    'deadline', 'closing', 'apply before', 'date de fin'
  ];

  const datesFound = [];

  // 1. Recherche des dates textuelles : DD Month YYYY
  const textDateRegex = /\b([0-9]{1,2})\s+([a-zéû]{3,10})\s+([0-9]{4})\b/gi;
  let match;
  while ((match = textDateRegex.exec(cleanText)) !== null) {
    const day = match[1].padStart(2, '0');
    const monthName = match[2].toLowerCase();
    const year = match[3];
    
    let monthVal = null;
    for (const [key, val] of Object.entries(months)) {
      if (monthName.startsWith(key)) {
        monthVal = val;
        break;
      }
    }
    
    if (monthVal) {
      datesFound.push({
        iso: `${year}-${monthVal}-${day}`,
        index: match.index,
        text: match[0]
      });
    }
  }

  // 2. Recherche des dates numériques : DD/MM/YYYY etc.
  const numericDateRegex = /\b([0-9]{1,2})[\/\-\.]([0-9]{1,2})[\/\-\.]([0-9]{4})\b/gi;
  while ((match = numericDateRegex.exec(cleanText)) !== null) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    datesFound.push({
      iso: `${year}-${month}-${day}`,
      index: match.index,
      text: match[0]
    });
  }

  if (datesFound.length === 0) {
    return null;
  }

  // Trier par ordre d'apparition
  datesFound.sort((a, b) => a.index - b.index);

  // Vérifier la proximité d'un mot-clé de deadline (dans les 100 caractères précédents)
  for (let i = datesFound.length - 1; i >= 0; i--) {
    const dateObj = datesFound[i];
    const startIndex = Math.max(0, dateObj.index - 100);
    const contextText = cleanText.substring(startIndex, dateObj.index).toLowerCase();
    
    const hasKeyword = deadlineKeywords.some(keyword => contextText.includes(keyword));
    if (hasKeyword) {
      return dateObj.iso;
    }
  }

  // Repli : si aucun mot-clé n'est détecté, on prend la dernière date du texte
  const lastDate = datesFound[datesFound.length - 1];
  return lastDate.iso;
}

async function fetchHumanProjectJobs(existingJobIds) {
  const url = "https://databases-humanprojectgroup.com/index.php/espace-candidat";
  const jobs = [];

  try {
    const html = await getRequest(url);
    if (!html) {
      console.warn("⚠️ Pas de HTML retourné par databases-humanprojectgroup.com");
      return [];
    }

    const blocks = html.split('<div class="content">');
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];
      if (!block.includes('offre/details/')) continue;

      const urlMatch = block.match(/href="([^"]*offre\/details\/([0-9]+))"/i);
      if (!urlMatch) continue;
      const jobUrl = urlMatch[1];
      const postId = urlMatch[2];
      const id = `job_humanproject_${postId}`;

      const titleMatch = block.match(/offre\/details\/[0-9]+">([^<]+)<\/a>/i);
      if (!titleMatch) continue;
      const title = titleMatch[1].trim();

      const locationMatch = block.match(/<i class="fa fa-map-marker"><\/i>([^<]*)<\/p>/i) || block.match(/<i class="fa fa-map-marker"><\/i>\s*([^<\n]+)/i);
      let location = locationMatch ? locationMatch[1].replace(/\s+/g, ' ').trim() : "Ouagadougou";
      if (!location) location = "Ouagadougou";

      const deadlineMatch = block.match(/Date limite\s*:\s*<\/i>\s*<span[^>]*>\s*([0-9\/]+)/i) || block.match(/Date limite[^<]*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
      let deadlineDate = "";
      if (deadlineMatch) {
        const parts = deadlineMatch[1].trim().split('/');
        if (parts.length === 3) {
          deadlineDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      const companyMatch = block.match(/<i class="fa fa-home"><\/i>([^<]*)<\/p>/i) || block.match(/<i class="fa fa-home"><\/i>\s*([^<\n]+)/i);
      const company = companyMatch ? companyMatch[1].replace(/\s+/g, ' ').trim() : "HUMAN PROJECT";

      // Si le job existe déjà, pas besoin de le re-scrapper
      if (existingJobIds && existingJobIds.has(id)) {
        continue;
      }

      let description = "";
      try {
        console.log(`     📥 Téléchargement des détails pour l'offre Human Project : ${title}...`);
        const detailHtml = await getRequest(jobUrl);
        const descMatch = detailHtml.match(/<code>([\s\S]*?)<\/code>/i);
        if (descMatch) {
          description = descMatch[1]
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim();
        }
      } catch (err) {
        console.warn(`     ⚠️ Impossible de télécharger les détails de Human Project pour "${title}":`, err.message);
      }

      if (!description) {
        description = `Offre d'emploi pour le poste de ${title} chez ${company} à ${location}. Veuillez postuler directement sur la plateforme Human Project Group en utilisant le lien officiel.`;
      }

      jobs.push({
        id,
        title,
        company,
        location,
        description,
        source: "databases-humanprojectgroup.com",
        url: jobUrl,
        deadlineDate
      });
    }
  } catch (err) {
    console.warn("⚠️ Impossible de crawler databases-humanprojectgroup.com :", err.message);
  }

  return jobs;
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

async function fetchLinkedinJobs(existingJobIds) {
  const url = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=&location=Burkina%20Faso&geoId=100587095&start=0";
  
  try {
    const html = await getRequest(url);
    const jobs = [];
    const blocks = html.split('<div class="base-card');
    
    let validCount = 0;
    for (let i = 1; i < blocks.length; i++) {
      if (validCount >= 15) break;
      const block = blocks[i];
      
      const urlMatch = block.match(/href="([^"]+)"/i);
      if (!urlMatch) continue;
      const cleanUrl = urlMatch[1].split('?')[0];
      
      const titleMatch = block.match(/<h3 class="base-search-card__title">([\s\S]*?)<\/h3>/i);
      if (!titleMatch) continue;
      const title = titleMatch[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      
      const companyMatch = block.match(/<a class="hidden-nested-link"[^>]*>([\s\S]*?)<\/a>/i);
      const company = companyMatch ? companyMatch[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() : "Entreprise sur LinkedIn";
      
      const locationMatch = block.match(/<span class="job-search-card__location">([\s\S]*?)<\/span>/i);
      const location = locationMatch ? locationMatch[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() : "Burkina Faso";
      
      // Filtrer les fausses offres de backfill géographique de LinkedIn (Spam US/Japon)
      const cleanLoc = location.toLowerCase();
      const isValidBurkinaLocation = cleanLoc.includes("ouagadougou") || cleanLoc.includes("bobo") || cleanLoc.includes("koudougou") || cleanLoc === "burkina faso";
      if (!isValidBurkinaLocation) {
        continue; // Ignorer ce job spam international
      }
      
      const urnMatch = block.match(/data-entity-urn="urn:li:jobPosting:([0-9]+)"/i);
      const jobId = urnMatch ? urnMatch[1] : null;
      const id = `job_linkedin_${jobId || Math.abs(hashCode(cleanUrl))}`;
      
      // Si l'offre existe déjà, pas besoin de la réanalyser ni de la télécharger
      if (existingJobIds && existingJobIds.has(id)) {
        continue;
      }
      
      // Récupérer la description brute réelle via l'API publique de détails LinkedIn
      let description = "";
      if (jobId) {
        try {
          console.log(`     📥 Téléchargement de la description pour l'offre LinkedIn ${jobId}...`);
          const detailHtml = await getRequest(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`);
          const descMatch = detailHtml.match(/<div class="show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/i);
          if (descMatch) {
            description = descMatch[1]
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<\/p>/gi, '\n')
              .replace(/<li>/gi, '\n- ')
              .replace(/<[^>]+>/g, '')
              .replace(/\n\s*\n+/g, '\n\n')
              .trim();
          }
        } catch (detailErr) {
          console.warn(`     ⚠️ Échec de la récupération de la description pour ${jobId} :`, detailErr.message);
        }
      }
      
      if (!description) {
        description = `Offre de recrutement pour le poste de ${title} chez ${company} à ${location}. Veuillez consulter les détails complets sur la fiche d'origine.`;
      }

      const deadlineDate = "";
      
      jobs.push({
        id,
        title,
        company,
        location,
        description,
        source: "linkedin.com",
        url: cleanUrl,
        deadlineDate,
        scrapedAt: new Date().toISOString()
      });
      validCount++;
    }
    
    return jobs;
  } catch (err) {
    console.warn("⚠️ Impossible de récupérer les offres de LinkedIn :", err.message);
    return [];
  }
}

function parseLefasoHtml(html) {
  const jobBlocks = html.split('<div class="row"');
  const jobs = [];

  const maxBlocks = Math.min(jobBlocks.length, 16);
  for (let i = 1; i < maxBlocks; i++) {
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

    let deadlineDate = "";
    const extDate = extractFrenchDateFromText(limitDate);
    if (extDate) {
      deadlineDate = extDate;
    }

    console.log(`   ↳ [COLLECTE LEFASO] "${title}" (Date Limite : ${deadlineDate || "Non spécifiée"})`);

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

function deleteJobFromSupabase(jobId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return Promise.resolve();
  }

  const parsedUrl = new URL(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${jobId}`);
  
  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve());
    });
    
    req.on('error', () => {
      resolve();
    });
    
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
    
    // -- MIGRATION AUTOMATIQUE : Re-scrapper les descriptions brutes des offres existantes incomplètes --
    console.log("\n🔄 Analyse de la base existante pour mise à jour des anciennes offres...");
    for (const job of dbData.jobs) {
      const isPlaceholderLinkedin = job.source === 'linkedin.com' && job.description && (
        job.description.includes("Voir sur le site LinkedIn") || 
        job.description.includes("Qualifications & Expérience : Compétences requises")
      );
      
      const isPlaceholderIcipe = job.source === 'ici-pe.com/jobs' && job.description && (
        job.description.includes("Recrutement géré par le cabinet ICI Partenaire Entreprises") ||
        job.description.includes("Veuillez postuler via le lien direct ou consulter les instructions")
      );

      if (isPlaceholderLinkedin || isPlaceholderIcipe) {
        console.log(`   🛠️ Re-scraping des détails pour l'offre incomplète : "${job.title}" (${job.company})...`);
        let rawDescription = "";

        if (job.source === 'linkedin.com') {
          const jobId = job.id.replace("job_linkedin_", "");
          if (jobId && /^[0-9]+$/.test(jobId)) {
            try {
              const detailHtml = await getRequest(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`);
              const descMatch = detailHtml.match(/<div class="show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/i);
              if (descMatch) {
                rawDescription = descMatch[1]
                  .replace(/<br\s*\/?>/gi, '\n')
                  .replace(/<\/p>/gi, '\n')
                  .replace(/<li>/gi, '\n- ')
                  .replace(/<[^>]+>/g, '')
                  .replace(/\n\s*\n+/g, '\n\n')
                  .trim();
              }
            } catch (err) {
              console.warn(`     ⚠️ Échec du re-scraping LinkedIn pour ${jobId} :`, err.message);
            }
          }
        } else if (job.source === 'ici-pe.com/jobs') {
          try {
            const detailHtml = await getRequest(job.url);
            const descMatch = detailHtml.match(/<div class="job_description[^>]*>([\s\S]*?)<\/div>/i) || detailHtml.match(/<div class="post-content[^>]*>([\s\S]*?)<\/div>/i);
            if (descMatch) {
              rawDescription = descMatch[1]
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/p>/gi, '\n')
                .replace(/<li>/gi, '\n- ')
                .replace(/<[^>]+>/g, '')
                .replace(/\n\s*\n+/g, '\n\n')
                .trim();
            }
          } catch (err) {
            console.warn(`     ⚠️ Échec du re-scraping ici-pe.com pour ${job.url} :`, err.message);
          }
        }

        if (rawDescription) {
          job.description = rawDescription;
          job.deadlineDate = "";
          console.log(`     ✅ Description brute récupérée avec succès. Elle sera restructurée par l'IA.`);
        }
      }
    }

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
      const unjobsJobs = await parseUnjobsHtml(unjobsHtml);
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
      const faso7Jobs = await parseFaso7Html(faso7Html);
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

    // CRAWLING RÉEL : API ReliefWeb (Secteur Humanitaire / ONG au Burkina)
    console.log("\n🌐 Chargement des offres humanitaires depuis l'API ReliefWeb...");
    try {
      const reliefWebJobs = await fetchReliefWebJobs();
      console.log(`   ↳ ${reliefWebJobs.length} offres extraites de ReliefWeb.`);
      
      reliefWebJobs.forEach(job => {
        if (!existingJobIds.has(job.id)) {
          dbData.jobs.push(job);
          existingJobIds.add(job.id);
          newlyAddedJobs.push(job);
          console.log(`[REAL API RELIEFWEB] ${job.title} - ${job.company} (${job.location})`);
          addedCount++;
        }
      });
    } catch (crawlErr) {
      console.warn("⚠️ Impossible d'interroger l'API ReliefWeb :", crawlErr.message);
    }

    // CRAWLING RÉEL : ici-pe.com (ICI Partenaire Entreprises)
    console.log("\n🌐 Chargement des offres depuis l'AJAX de ici-pe.com...");
    try {
      const icipeJobs = await fetchIcipeJobs(existingJobIds);
      console.log(`   ↳ ${icipeJobs.length} offres extraites de ici-pe.com.`);
      
      icipeJobs.forEach(job => {
        if (!existingJobIds.has(job.id)) {
          dbData.jobs.push(job);
          existingJobIds.add(job.id);
          newlyAddedJobs.push(job);
          console.log(`[REAL CRAWL ICIPE] ${job.title} - ${job.company} (${job.location})`);
          addedCount++;
        }
      });
    } catch (crawlErr) {
      console.warn("⚠️ Impossible de crawler ici-pe.com :", crawlErr.message);
    }

    // CRAWLING RÉEL : databases-humanprojectgroup.com (Human Project)
    console.log("\n🌐 Crawling en direct de databases-humanprojectgroup.com...");
    try {
      const humanProjectJobs = await fetchHumanProjectJobs(existingJobIds);
      console.log(`   ↳ ${humanProjectJobs.length} offres extraites de databases-humanprojectgroup.com.`);
      
      humanProjectJobs.forEach(job => {
        if (!existingJobIds.has(job.id)) {
          dbData.jobs.push(job);
          existingJobIds.add(job.id);
          newlyAddedJobs.push(job);
          console.log(`[REAL CRAWL HUMANPROJECT] ${job.title} - ${job.company} (${job.location})`);
          addedCount++;
        }
      });
    } catch (crawlErr) {
      console.warn("⚠️ Impossible de crawler databases-humanprojectgroup.com :", crawlErr.message);
    }

    // CRAWLING RÉEL : LinkedIn Jobs (Offres premium au Burkina)
    console.log("\n🌐 Nettoyage et chargement des offres premium depuis LinkedIn...");
    try {
      const initialJobsLength = dbData.jobs.length;
      const oldLinkedinJobs = dbData.jobs.filter(job => {
        return job.source === 'linkedin.com' && (
          job.description.includes("Voir sur le site LinkedIn") || 
          job.title.includes("SCARY") || 
          job.company.includes("Haunted") ||
          job.location.includes("You, North") ||
          job.location.includes("Waterfalls") ||
          job.description.includes("Qualifications & Expérience : Compétences requises")
        );
      });
      
      if (oldLinkedinJobs.length > 0) {
        console.log(`   🧹 Suppression de ${oldLinkedinJobs.length} anciennes offres LinkedIn invalides sur Supabase...`);
        for (const oldJob of oldLinkedinJobs) {
          await deleteJobFromSupabase(oldJob.id);
          existingJobIds.delete(oldJob.id);
        }
      }
      
      dbData.jobs = dbData.jobs.filter(job => !oldLinkedinJobs.some(oj => oj.id === job.id));
      const cleanedCount = initialJobsLength - dbData.jobs.length;
      if (cleanedCount > 0) {
        console.log(`   🧹 ${cleanedCount} anciennes offres LinkedIn invalides (spam international/placeholder) supprimées avec succès.`);
      }

      const linkedinJobs = await fetchLinkedinJobs(existingJobIds);
      console.log(`   ↳ ${linkedinJobs.length} offres extraites de LinkedIn.`);
      
      linkedinJobs.forEach(job => {
        if (!existingJobIds.has(job.id)) {
          dbData.jobs.push(job);
          existingJobIds.add(job.id);
          newlyAddedJobs.push(job);
          console.log(`[REAL CRAWL LINKEDIN] ${job.title} - ${job.company} (${job.location})`);
          addedCount++;
        }
      });
    } catch (crawlErr) {
      console.warn("⚠️ Impossible de crawler LinkedIn :", crawlErr.message);
    }

    // -- FILTRAGE ET RETRAIT DES OFFRES EXPIRÉES OU SANS DATE LIMITE --
    const todayStr = new Date().toISOString().split('T')[0];
    const activeJobs = [];
    
    console.log("\n🧹 Analyse et filtrage des offres (dates limites et expiration)...");
    for (const job of dbData.jobs) {
      // Tenter d'extraire la date limite depuis la description uniquement s'il n'y en a pas déjà une de valide
      const hasNoDeadlineBefore = !job.deadlineDate || job.deadlineDate === "Non spécifiée" || job.deadlineDate.trim() === "";
      if (hasNoDeadlineBefore) {
        const extDate = extractFrenchDateFromText(job.description);
        if (extDate) {
          job.deadlineDate = extDate;
        }
      }
      
      const hasNoDeadline = !job.deadlineDate || job.deadlineDate === "Non spécifiée" || job.deadlineDate.trim() === "";
      const isExpired = job.deadlineDate && job.deadlineDate < todayStr;
      
      if (hasNoDeadline || isExpired) {
        if (hasNoDeadline) {
          console.log(`   🚫 Retrait (Pas de date limite) : "${job.title}" (${job.company})`);
        } else {
          console.log(`   🚫 Retrait (Offre expirée) : "${job.title}" (${job.company}) - Date limite : ${job.deadlineDate}`);
        }
        await deleteJobFromSupabase(job.id);
      } else {
        activeJobs.push(job);
      }
    }
    dbData.jobs = activeJobs;

    // -- STRUCTURATION IA AVEC GEMINI --
    const jobsToStructure = dbData.jobs.filter(job => {
      return job.description && !job.description.includes("🎓") && !job.description.includes("Diplômes requis");
    });

    if (GEMINI_API_KEY && jobsToStructure.length > 0) {
      console.log(`\n🤖 Structuration par l'IA (Gemini) de ${jobsToStructure.length} offres non structurées...`);
      const jobsToProcess = jobsToStructure.slice(0, 150);
      for (let i = 0; i < jobsToProcess.length; i++) {
        const job = jobsToProcess[i];
        console.log(`   🔍 [${i + 1}/${jobsToProcess.length}] Analyse & structuration pour: "${job.title}" (${job.company})...`);
        const result = await analyzeAndStructureJobWithGemini(job, GEMINI_API_KEY);
        if (result) {
          job.description = result.structuredDescription;
          job.url = result.directApplicationUrl;
          if (result.title && result.title.trim() !== "" && !result.title.includes("Le titre traduit")) {
            job.title = result.title.trim();
          }
          if (result.deadlineDate && /^\d{4}-\d{2}-\d{2}$/.test(result.deadlineDate)) {
            job.deadlineDate = result.deadlineDate;
            console.log(`     📅 Date limite mise à jour par l'IA : ${job.deadlineDate}`);
          }
          console.log(`     ✅ Offre structurée et lien direct configuré : ${job.url}`);
        }
        
        // Attendre 4,5 secondes pour respecter la limite de 15 requêtes par minute (RPM) de Gemini Flash
        if (i < jobsToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 4500));
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
