const fs = require('fs');
const path = require('path');
const https = require('https');

const DB_PATH = path.join(__dirname, 'database.json');
const CURRENT_DATE = new Date("2026-06-29");

// Utilitaire pour faire une requête HTTP POST native
function postRequest(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(data))
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`HTTP Error ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(JSON.stringify(data));
    req.end();
  });
}

// Fonction pour appeler l'API Gemini
// Fonction pour appeler l'API Gemini
async function analyzeMatchWithGemini(user, job, apiKey) {
  const prompt = `Tu es un conseiller en recrutement chaleureux et dynamique. Compare le profil du candidat avec l'offre d'emploi ci-dessous.

PROFIL DU CANDIDAT:
Nom: ${user.fullname}
Métier recherché: ${user.jobtitle}
Ville: ${user.location}
Description/CV: ${user.cvtext}

OFFRE D'EMPLOI:
Titre: ${job.title}
Entreprise: ${job.company}
Ville: ${job.location}
Description: ${job.description}

Détermine si le profil correspond à l'offre. Réponds dans un français simple, enthousiaste et facile à comprendre. Rédige une explication vivante, claire et ajoute à la fin une belle phrase de motivation chaleureuse et personnalisée pour encourager le candidat à postuler si la correspondance est bonne.
Réponds UNIQUEMENT au format JSON brut suivant, sans blocs markdown, juste le JSON brut :
{
  "match": true ou false,
  "score": (note sur 100 indiquant le niveau de correspondance),
  "explanation": "Ton analyse encourageante et dynamique (2 ou 3 phrases max) avec une phrase de motivation inspirante à la fin."
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
    console.warn("⚠️ Échec de l'appel Gemini API, basculement en mode simulation.");
    return mockGeminiAnalysis(user, job);
  }
}

// Simulation locale de l'IA (en français simple et motivant)
function mockGeminiAnalysis(user, job) {
  const userText = (user.jobtitle + " " + user.cvtext).toLowerCase();
  const jobText = (job.title + " " + job.description).toLowerCase();
  
  let score = 50; 
  let match = false;

  // Matching sémantique simple sur les mots clés du métier
  if (userText.includes("chauffeur") && jobText.includes("chauffeur")) {
    score = 90;
    match = true;
  } else if (userText.includes("comptable") && jobText.includes("recouvrement")) {
    score = 92;
    match = true;
  } else if (userText.includes("gérant") && jobText.includes("boutique")) {
    score = 88;
    match = true;
  } else if (userText.includes("communication") && jobText.includes("communication")) {
    score = 94;
    match = true;
  }

  let explanation = "";
  if (match) {
    explanation = `Superbe opportunité ! Le poste de "${job.title}" correspond parfaitement à vos souhaits de métier en tant que "${user.jobtitle}". Vos compétences conviennent très bien pour cette offre à "${job.location}". Foncez et postulez sans hésiter, vous avez le profil idéal ! 🌟`;
  } else {
    explanation = `La correspondance n'est pas idéale pour le poste de "${job.title}". Vos métiers de recherche diffèrent des exigences de cette offre. Mais gardez le cap, continuez vos recherches, la bonne offre vous attend ! 💪`;
  }

  return { match, score, explanation };
}

const querystring = require('querystring');

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || ""; // ex: 'whatsapp:+14155238886' ou '+1234567890'

function sendRealEmail(user, job, result, remainingAlerts = null) {
  if (!RESEND_API_KEY) {
    return Promise.resolve(false);
  }

  let alertWarningHtml = "";
  if (remainingAlerts !== null) {
    alertWarningHtml = `
      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; color: #b45309; padding: 15px; border-radius: 8px; margin-top: 25px; font-size: 0.95rem; font-weight: bold; text-align: center; border-left: 4px solid #f59e0b;">
        ⚠️ Attention : Il vous reste uniquement ${remainingAlerts} alerte(s) gratuite(s) sur 3.<br>
        <span style="font-weight: normal; font-size: 0.85rem; color: #78350f;">Pour continuer à recevoir toutes les offres d'emploi compatibles par Email/WhatsApp sans interruption, passez à la version Premium !</span>
      </div>
    `;
  }

  const payload = JSON.stringify({
    from: `carréemploie <${RESEND_FROM_EMAIL}>`,
    to: [user.email],
    subject: `[carréemploie] Nouvelle offre d'emploi : ${job.title} - ${job.company}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; line-height: 1.6;">
        <h2 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 8px;">carréemploie - Alerte IA 🌟</h2>
        <p>Bonjour <strong>${user.fullname}</strong>,</p>
        <p>Le robot intelligent a trouvé une opportunité correspondant à votre recherche de <strong>${user.jobtitle}</strong> :</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #111827;">${job.title}</h3>
          <p><strong>Entreprise :</strong> ${job.company}</p>
          <p><strong>Lieu :</strong> ${job.location}</p>
          <p><strong>Description :</strong> ${job.description.substring(0, 200)}...</p>
        </div>
        <p><strong>Pourquoi l'IA valide ce match (${result.score}%) ?</strong></p>
        <p style="font-style: italic; color: #555; background: #fafafa; padding: 10px; border-radius: 4px; border-left: 3px solid #6b7280;">"${result.explanation}"</p>
        <p style="margin-top: 25px;">
          <a href="${job.url}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Postuler à l'offre</a>
        </p>
        ${alertWarningHtml}
        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 11px; color: #999;">Cet e-mail a été généré automatiquement par carréemploie.</p>
      </div>
    `
  });

  const options = {
    hostname: 'api.resend.com',
    port: 443,
    path: '/emails',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`   ✉️ [RESEND SUCCESS] E-mail d'alerte envoyé avec succès à : ${user.email}`);
          resolve(true);
        } else {
          console.warn(`   ✉️ [RESEND ERROR] Code HTTP ${res.statusCode} : ${body}`);
          resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      console.warn(`   ✉️ [RESEND ERROR] Impossible de se connecter à Resend :`, e.message);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

function sendRealTwilioMessage(user, job, result, remainingAlerts = null) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    return Promise.resolve(false);
  }

  const isWhatsApp = TWILIO_FROM_NUMBER.startsWith('whatsapp:');
  const cleanPhone = user.phone.replace(/[^0-9+]/g, '');
  const toValue = isWhatsApp ? `whatsapp:${cleanPhone}` : cleanPhone;
  
  let messageText = `carréemploie Alert 🌟: Bonjour ${user.fullname}, un travail de "${job.title}" est disponible à ${job.location} ! Score IA : ${result.score}%. Raison: ${result.explanation} Voir l'offre : ${job.url}`;

  if (remainingAlerts !== null) {
    messageText += `\n\n⚠️ Il vous reste ${remainingAlerts} alerte(s) gratuite(s) sur 3. Passez Premium pour recevoir toutes les alertes en continu !`;
  }

  const postData = querystring.stringify({
    To: toValue,
    From: TWILIO_FROM_NUMBER,
    Body: messageText
  });

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

  const options = {
    hostname: 'api.twilio.com',
    port: 443,
    path: `/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`   💬 [TWILIO SUCCESS] Alerte WhatsApp/SMS envoyée avec succès à : ${user.phone}`);
          resolve(true);
        } else {
          console.warn(`   💬 [TWILIO ERROR] Code HTTP ${res.statusCode} : ${body}`);
          resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      console.warn(`   💬 [TWILIO ERROR] Impossible de se connecter à Twilio :`, e.message);
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

// Envoyer la notification
async function sendNotification(user, job, result, remainingAlerts = null) {
  const notificationId = `notif_${user.id}_${job.id}_${Date.now()}`;
  let sentViaResend = false;
  let sentViaTwilio = false;
  
  console.log(`\n🔔 ENVOI D'ALERTE POUR : ${user.fullname} 🔔`);
  
  if (user.notifyEmail) {
    if (RESEND_API_KEY) {
      sentViaResend = await sendRealEmail(user, job, result, remainingAlerts);
    } else {
      console.log(`✉️ [EMAIL SIMULÉ VIA RESEND] Envoyé à: ${user.email}`);
      console.log(`   Sujet: Emploi trouvé : ${job.title} - ${job.company} (${result.score}% match IA)`);
      console.log(`   Contenu: "Bonjour ${user.fullname}, carréemploie a trouvé un job idéal : ${job.title} chez ${job.company}.`);
      console.log(`   Pourquoi ? ${result.explanation}`);
      console.log(`   Lien de l'offre: ${job.url}"`);
      if (remainingAlerts !== null) {
        console.log(`   ⚠️ [TRIAL NOTIF] Il reste ${remainingAlerts} alertes gratuites sur 3.`);
      }
      sentViaResend = true;
    }
  }

  if (user.notifyWhatsapp && user.phone) {
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) {
      sentViaTwilio = await sendRealTwilioMessage(user, job, result, remainingAlerts);
    } else {
      console.log(`💬 [WHATSAPP SIMULÉ VIA TWILIO] Envoyé à: ${user.phone}`);
      console.log(`   Message: "carréemploie Alert 🌟: Bonjour ${user.fullname}, un travail de ${job.title} est trouvé à ${job.location} ! Score IA : ${result.score}%. Raison: ${result.explanation} Voir l'offre : ${job.url}"`);
      if (remainingAlerts !== null) {
        console.log(`   ⚠️ [TRIAL NOTIF] Il reste ${remainingAlerts} alertes gratuites sur 3.`);
      }
      sentViaTwilio = true;
    }
  }
  
  console.log("--------------------------------------------------");
  
  return {
    id: notificationId,
    userId: user.id,
    jobId: job.id,
    score: result.score,
    channel: { email: user.notifyEmail, whatsapp: user.notifyWhatsapp },
    sentAt: new Date().toISOString()
  };
}

const SUPABASE_URL = process.env.SUPABASE_URL || "https://yyqybbzlcrvwupfbjwtc.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_U9d1sl9kQIbqHH1TX8E2yQ_ZqoWGd28";

function supabaseRequest(method, path, data = null) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return Promise.reject(new Error("Supabase non configuré"));
  }

  const parsedUrl = new URL(`${SUPABASE_URL}/rest/v1${path}`);
  
  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  };

  if (method === 'POST') {
    options.headers['Prefer'] = 'resolution=merge-duplicates';
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(new Error(`HTTP Error ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (e) => reject(e));

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runMatcher() {
  console.log("==================================================");
  console.log("🤖 Lancement du moteur de Matching IA...");
  console.log("==================================================");

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (GEMINI_API_KEY) {
    console.log("🔑 Clé API Gemini détectée. Analyse réelle activée.");
  } else {
    console.log("ℹ️ Aucune clé GEMINI_API_KEY trouvée dans l'environnement. Mode simulation IA activé.");
  }

  try {
    let users = [];
    let jobs = [];
    let notifications = [];
    let isUsingSupabase = false;

    // Tentative de récupération depuis Supabase
    if (SUPABASE_URL && SUPABASE_KEY) {
      console.log("⚡ Connexion active à Supabase détectée. Lecture des données cloud...");
      try {
        const rawUsers = await supabaseRequest('GET', '/users?select=*');
        const rawJobs = await supabaseRequest('GET', '/jobs?select=*');
        const rawNotifs = await supabaseRequest('GET', '/notifications?select=*');

        users = rawUsers.map(u => ({
          id: u.id,
          fullname: u.fullname,
          email: u.email,
          phone: u.phone,
          location: u.location,
          jobtitle: u.jobtitle,
          cvtext: u.cvtext,
          notifyEmail: u.notify_email,
          notifyWhatsapp: u.notify_whatsapp,
          subscriptionStatus: u.subscription_status,
          subscriptionDaysRemaining: u.subscription_days_remaining,
          createdAt: u.created_at
        }));

        jobs = rawJobs.map(j => ({
          id: j.id,
          title: j.title,
          company: j.company,
          location: j.location,
          description: j.description,
          source: j.source,
          url: j.url,
          deadlineDate: j.deadline_date,
          scrapedAt: j.scraped_at
        }));

        notifications = rawNotifs.map(n => ({
          id: n.id,
          userId: n.user_id,
          jobId: n.job_id,
          score: n.score,
          sentAt: n.sent_at
        }));

        isUsingSupabase = true;
        console.log(`✅ Supabase lu : ${users.length} candidats, ${jobs.length} jobs, ${notifications.length} alertes antérieures.`);
      } catch (err) {
        console.warn("⚠️ Échec de lecture Supabase, basculement sur la base locale.", err.message);
      }
    }

    // Fallback base locale si Supabase non configuré ou en échec
    if (!isUsingSupabase) {
      if (!fs.existsSync(DB_PATH)) {
        console.error("Base de données locale introuvable ! Lancez le scraper d'abord.");
        return;
      }
      const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      users = db.users;
      jobs = db.jobs;
      notifications = db.notifications;
    }

    if (users.length === 0) {
      console.log("Aucun candidat inscrit. Fin de la tâche.");
      return;
    }

    if (jobs.length === 0) {
      console.log("Aucune offre d'emploi en base. Fin de la tâche.");
      return;
    }

    const sentPairs = new Set(notifications.map(n => `${n.userId}_${n.jobId}`));
    const userAlertCounts = {};
    notifications.forEach(n => {
      userAlertCounts[n.userId] = (userAlertCounts[n.userId] || 0) + 1;
    });

    let newAlertsCount = 0;

    for (const user of users) {
      console.log(`\n👤 Traitement du profil : ${user.fullname} (${user.jobtitle})`);
      
      const isFree = user.subscriptionStatus === "Gratuit" || !user.subscriptionStatus;
      let daysRemaining = user.subscriptionDaysRemaining || 0;
      const alreadySentCount = userAlertCounts[user.id] || 0;

      // -- VÉRIFICATION ABONNEMENT ET LIMITATION --
      if (isFree && alreadySentCount >= 3) {
        console.log(`   ⚠️ [BLOCKED] ${user.fullname} est en Forfait Gratuit et a déjà reçu ses 3 alertes gratuites. Abonnement requis.`);
        continue;
      }

      if (!isFree && daysRemaining <= 0) {
        console.log(`   ⚠️ [BLOCKED] L'abonnement Premium de ${user.fullname} a expiré (0 jour restant).`);
        user.subscriptionStatus = "Gratuit";
        daysRemaining = 0;
        
        if (isUsingSupabase) {
          await supabaseRequest('PATCH', `/users?id=eq.${user.id}`, {
            subscription_status: "Gratuit",
            subscription_days_remaining: 0
          });
        }
        continue;
      }

      console.log(`   [Abonnement : ${user.subscriptionStatus} - ${daysRemaining} jours restants (Déjà alerté ${alreadySentCount} fois)]`);

      // -- ÉTAPE 1 : Pré-filtrage par mots-clés et date limite (SANS restriction de ville) --
      const filteredJobs = jobs.filter(job => {
        if (sentPairs.has(`${user.id}_${job.id}`)) return false;

        // A. Date limite active uniquement
        if (job.deadlineDate) {
          const limit = new Date(job.deadlineDate);
          if (limit < CURRENT_DATE) return false;
        }

        // B. Correspondance métier (support multi-métiers séparés par des virgules)
        const userKeywords = user.jobtitle.toLowerCase().split(',').map(t => t.trim()).filter(t => t.length > 0);
        const jobTitleLower = job.title.toLowerCase();
        const jobDescLower = job.description.toLowerCase();
        
        return userKeywords.some(term => {
          const words = term.split(/\s+/).filter(w => w.length > 3);
          if (words.length === 0) {
            return jobTitleLower.includes(term) || jobDescLower.includes(term);
          }
          return words.some(word => jobTitleLower.includes(word) || jobDescLower.includes(word));
        });
      });

      console.log(`   ↳ Pré-filtrage : ${filteredJobs.length} offres actives potentielles trouvées (sur ${jobs.length} totales)`);

      // -- ÉTAPE 2 : Analyse fine par l'IA --
      let currentSentInRun = alreadySentCount;
      for (const job of filteredJobs) {
        if (isFree && currentSentInRun >= 3) {
          console.log(`   ⚠️ [BLOCKED IN-RUN] Limite de 3 alertes gratuites atteinte pour cette exécution.`);
          break;
        }

        console.log(`   🔍 Analyse IA pour l'offre active: "${job.title}" (${job.company}) à ${job.location}`);
        
        let result;
        if (GEMINI_API_KEY) {
          result = await analyzeMatchWithGemini(user, job, GEMINI_API_KEY);
        } else {
          result = mockGeminiAnalysis(user, job);
        }

        if (result.match && result.score >= 70) {
          console.log(`   ✅ MATCH VALIDÉ par l'IA (${result.score}%)`);
          const remainingAlerts = isFree ? Math.max(0, 3 - (currentSentInRun + 1)) : null;
          const notif = await sendNotification(user, job, result, remainingAlerts);
          notifications.push(notif);
          
          // Sauvegarde en ligne Supabase si active
          if (isUsingSupabase) {
            try {
              await supabaseRequest('POST', '/notifications', {
                id: notif.id,
                user_id: notif.userId,
                job_id: notif.jobId,
                score: notif.score,
                sent_at: notif.sentAt
              });
              console.log("   ⚡ Alerte insérée dans la table notifications sur Supabase.");
            } catch (err) {
              console.error("   ❌ Erreur d'enregistrement notification Supabase:", err.message);
            }
          }
          
          currentSentInRun++;
          newAlertsCount++;
        } else {
          console.log(`   ❌ MATCH REJETÉ par l'IA (${result.score}%) - Raison: ${result.explanation}`);
        }
      }

      // Décompte de journée d'abonnement
      if (!isFree && daysRemaining > 0) {
        const nextDays = Math.max(0, daysRemaining - 1);
        console.log(`   ⏳ [Mise à jour] Jours restants : ${nextDays}`);
        
        if (isUsingSupabase) {
          try {
            await supabaseRequest('PATCH', `/users?id=eq.${user.id}`, {
              subscription_days_remaining: nextDays,
              subscription_status: nextDays === 0 ? "Gratuit" : user.subscriptionStatus
            });
          } catch (err) {
            console.error("   ❌ Échec mise à jour jours Supabase:", err.message);
          }
        } else {
          user.subscriptionDaysRemaining = nextDays;
          if (nextDays === 0) user.subscriptionStatus = "Gratuit";
        }
      }
    }

    // Écriture locale finale
    if (!isUsingSupabase) {
      const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      db.users = users;
      db.notifications = notifications;
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
      console.log(`\n🏁 Traitement local terminé. ${newAlertsCount} alertes générées dans database.json.`);
    } else {
      console.log(`\n🏁 Traitement Supabase en ligne terminé. ${newAlertsCount} alertes générées.`);
    }
    console.log("==================================================\n");

  } catch (error) {
    console.error("Une erreur est survenue lors du matching :", error);
  }
}

if (require.main === module) {
  runMatcher();
}

module.exports = { runMatcher };
