document.addEventListener('DOMContentLoaded', () => {
    // --- 0. INITIALISATION DU CLIENT SUPABASE ---
    // Remplir ces variables avec vos clés réelles pour activer la base de données cloud
    const SUPABASE_URL = "https://yyqybbzlcrvwupfbjwtc.supabase.co"; 
    const SUPABASE_ANON_KEY = "sb_publishable_U9d1sl9kQIbqHH1TX8E2yQ_ZqoWGd28";
    
    let supabase = null;
    if (typeof window.supabase !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("⚡ Supabase connecté avec succès !");
        // Log visit in analytics table
        supabase.from('analytics').insert({ visit_type: 'page_view' })
            .then(() => console.log("📈 Visite comptabilisée sur Supabase."))
            .catch(err => console.warn("Alerte analytique :", err));
    } else {
        console.log("ℹ️ Supabase non configuré. Mode Démo Local (LocalStorage) activé.");
    }


    // 1. Navigation & Tab Switching
    const navLinks = document.querySelectorAll('.nav-link, .nav-logo');
    const tabContents = document.querySelectorAll('.tab-content');
    const ctaButtons = document.querySelectorAll('[data-target]');

    function switchTab(tabId) {
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.getAttribute('data-tab') === tabId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        tabContents.forEach(tab => {
            if (tab.id === tabId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tabId = link.getAttribute('data-tab');
            if (tabId) switchTab(tabId);
        });
    });

    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-target]');
        if (target) {
            const tabId = target.getAttribute('data-target');
            if (tabId) switchTab(tabId);
        }
    });


    // 2. Global State management (Local Storage + Supabase sync)
    let profile = JSON.parse(localStorage.getItem('user_profile')) || null;
    let subscriptionStatus = localStorage.getItem('sub_status') || 'Gratuit';
    let daysRemaining = parseInt(localStorage.getItem('sub_days') || '0');

    const navBadge = document.getElementById('nav-badge');
    const navBadgeText = document.getElementById('nav-badge-text');
    const dashFullname = document.getElementById('dash-fullname');
    const dashJobtitle = document.getElementById('dash-jobtitle');
    const dashStatus = document.getElementById('dash-status');
    const dashDaysRemaining = document.getElementById('dash-days-remaining');

    function updateGlobalUI() {
        if (daysRemaining > 0) {
            navBadge.className = "nav-status-badge premium";
            navBadgeText.textContent = `Premium : ${daysRemaining} jours`;
        } else {
            navBadge.className = "nav-status-badge";
            navBadgeText.textContent = "Forfait Gratuit";
        }

        if (profile) {
            dashFullname.textContent = profile.fullname;
            dashJobtitle.textContent = `${profile.jobtitle} à ${profile.location}`;
        } else {
            dashFullname.textContent = "Candidat non inscrit";
            dashJobtitle.textContent = "Veuillez configurer votre alerte IA";
        }

        if (daysRemaining > 0) {
            dashStatus.className = "status-value premium";
            dashStatus.textContent = subscriptionStatus;
            dashDaysRemaining.innerHTML = `<i class="fa-solid fa-crown text-gold"></i> ${daysRemaining} jours restants`;
        } else {
            dashStatus.className = "status-value free";
            dashStatus.textContent = "Compte Gratuit";
            dashDaysRemaining.innerHTML = `<i class="fa-solid fa-clock"></i> 0 jour restant`;
        }
    }


    // 3. Real jobs list from all targeted Burkinabe boards (Current Date: 2026-06-29)
    const SIMULATED_LOCAL_JOBS = [
        {
            "id": "job_lefaso_01",
            "title": "01 Agent(e) de Bureau",
            "company": "Mutuelle des Travailleurs (BTP/Social)",
            "location": "Ouagadougou",
            "description": "Recrutement d'un agent de bureau pour une mutuelle sociale. Niveau d'études requis : CAP, BEP ou BEPC. Tâches : accueil physique et téléphonique, gestion du courrier, archivage et secrétariat simple.",
            "source": "emploi.lefaso.net",
            "url": "https://lefaso.net/spip.php?article147499",
            "deadlineDate": "2025-12-31" 
        },
        {
            "id": "job_lefaso_02",
            "title": "01 Chef du Service Communication",
            "company": "HAGE Matériaux (Industrie)",
            "location": "Ouagadougou",
            "description": "Poste de direction de la communication. Vous devez maîtriser l'expression écrite et orale, avoir un bon esprit d'analyse et de synthèse, être créatif et savoir gérer le stress.",
            "source": "emploi.lefaso.net",
            "url": "https://lefaso.net/spip.php?article147499",
            "deadlineDate": "2026-09-15" 
        },
        {
            "id": "job_lefaso_03",
            "title": "01 Chargé de Recouvrement",
            "company": "Cabinet Universal Management Consulting",
            "location": "Ouagadougou",
            "description": "Recrutement d'un agent de recouvrement. Diplôme en comptabilité ou gestion exigé. Rigueur, autonomie et forte capacité de négociation pour le suivi des paiements clients.",
            "source": "emploi.lefaso.net",
            "url": "https://lefaso.net/spip.php?article147499",
            "deadlineDate": "2026-08-26" 
        },
        {
            "id": "job_lefaso_04",
            "title": "01 Médecin Dermatologue",
            "company": "Hôpital Saint Camille de Ouagadougou (HOSCO)",
            "location": "Ouagadougou",
            "description": "L'Hôpital Saint Camille recrute un médecin dermatologue spécialisé. Inscription obligatoire à l'Ordre national des médecins du Burkina Faso.",
            "source": "emploi.lefaso.net",
            "url": "https://lefaso.net/spip.php?article147499",
            "deadlineDate": "2025-10-27" 
        },
        {
            "id": "job_lefaso_05",
            "title": "01 Pharmacien Responsable",
            "company": "Entreprise de Distribution de Matériel Médical",
            "location": "Ouagadougou",
            "description": "Recrutement d'un pharmacien de distribution inscrit à l'Ordre des Pharmaciens du Burkina Faso. Supervision de la gestion des stocks, contrôle qualité et conseils techniques.",
            "source": "emploi.lefaso.net",
            "url": "https://lefaso.net/spip.php?article147499",
            "deadlineDate": "2026-08-29" 
        },
        {
            "id": "job_local_active_01",
            "title": "Chauffeur Livreur de Marchandises H/F",
            "company": "Safi Transports Oua",
            "location": "Ouagadougou",
            "description": "Recherche d'un chauffeur livreur. Permis B requis, conduite sécuritaire. Vous livrez des commerçants partenaires. Bonne connaissance de la ville.",
            "source": "emploi.lefaso.net",
            "url": "https://lefaso.net/spip.php?article147499",
            "deadlineDate": "2026-07-25" 
        },
        {
            "id": "job_local_active_02",
            "title": "Secrétaire Administrative H/F",
            "company": "Burkina Commerce SARL",
            "location": "Bobo-Dioulasso",
            "description": "Secrétariat, facturation, classement de documents, réponse téléphonique. Maîtrise de Word et Excel exigée. BEPC ou BAC.",
            "source": "emploi.lefaso.net",
            "url": "https://lefaso.net/spip.php?article147499",
            "deadlineDate": "2026-08-10" 
        },
        {
            "id": "job_fb_post_98765",
            "title": "Serveuse de Restaurant / Maquis",
            "company": "Le Maquis Plus (via Facebook)",
            "location": "Ouagadougou",
            "description": "Recrutement urgent de serveuses pour le service de midi et du soir. Profil accueillant et de bonne présentation. Contact WhatsApp direct fourni dans l'alerte Premium.",
            "source": "Page Facebook : Offres d'Emploi BF",
            "url": "https://www.facebook.com",
            "deadlineDate": "2026-07-10" 
        },
        {
            "id": "job_fb_post_43210",
            "title": "Secrétaire Comptable H/F",
            "company": "Boutique Faso Pagne",
            "location": "Bobo-Dioulasso",
            "description": "Gestion de la caisse, comptage du stock et facturation Excel pour une boutique de textile. Niveau BAC G2 exigé.",
            "source": "Page Facebook : Avis de Recrutement Faso",
            "url": "https://www.facebook.com",
            "deadlineDate": "2026-08-15" 
        },
        {
            "id": "job_icipe_01",
            "title": "Assistant(e) de Direction Bilingue H/F",
            "company": "Société Industrielle Locale",
            "location": "Ouagadougou",
            "description": "Gestion d'agenda, secrétariat, rédaction de rapports bilingues (anglais/français), organisation de réunions. 3 ans d'expérience requis.",
            "source": "ici-pe.com/jobs",
            "url": "https://www.ici-pe.com",
            "deadlineDate": "2026-07-28" 
        },
        {
            "id": "job_reliefweb_01",
            "title": "Responsable de Programme Nutrition",
            "company": "ONG Action Contre la Faim",
            "location": "Fada N'Gourma",
            "description": "Coordination de la réponse nutritionnelle d'urgence, encadrement des équipes de terrain, suivi budgétaire et rédaction des rapports bailleurs.",
            "source": "reliefweb.int",
            "url": "https://reliefweb.int/job/4040924/project-managers-value-chains-and-biodiversity-west-africa",
            "deadlineDate": "2026-08-05" 
        },
        {
            "id": "job_unjobs_01",
            "title": "Chauffeur de Sécurité (UNICEF)",
            "company": "UNICEF Burkina Faso",
            "location": "Ouagadougou",
            "description": "Conduite des véhicules officiels, transport du personnel de l'UNICEF en mission, maintien de la sécurité routière et entretien basique du véhicule. Permis B/C exigé.",
            "source": "unjobs.org",
            "url": "https://unjobs.org/duty_stations/oua",
            "deadlineDate": "2026-07-20" 
        },
        {
            "id": "job_burkina24_01",
            "title": "Agent Commercial Terrain",
            "company": "Société Faso Transit",
            "location": "Ouagadougou",
            "description": "Développement du portefeuille clients, prospection commerciale auprès des commerçants de Rood-Woko, suivi des commandes de fret.",
            "source": "burkina24.com",
            "url": "https://burkina24.com",
            "deadlineDate": "2026-08-12" 
        },
        {
            "id": "job_humanproject_01",
            "title": "Comptable Unique H/F",
            "company": "Human Project Group (Boutique Agro)",
            "location": "Ouagadougou",
            "description": "Gestion complète de la comptabilité générale, déclarations fiscales (TVA, IS), relations avec la banque et paie des employés.",
            "source": "databases-humanprojectgroup.com",
            "url": "https://databases-humanprojectgroup.com",
            "deadlineDate": "2026-07-30" 
        },
        {
            "id": "job_afriqueemplois_01",
            "title": "Superviseur de Chantier Mine",
            "company": "Faso Mining Services",
            "location": "Dori",
            "description": "Supervision des équipes d'excavation sur le site minier, respect des consignes de sécurité, reporting journalier au chef de projet.",
            "source": "afriqueemplois.com",
            "url": "https://afriqueemplois.com",
            "deadlineDate": "2026-08-20" 
        },
        {
            "id": "job_faso7_01",
            "title": "Conseiller Clientèle Microfinance H/F",
            "company": "Société Faso Crédit",
            "location": "Ouagadougou",
            "description": "Prospection et suivi d'un portefeuille de clients micro-entrepreneurs à Ouagadougou. Analyse des demandes de micro-crédits et suivi des remboursements.",
            "source": "faso7.com",
            "url": "https://faso7.com/2026/06/30/recrutement-dun-coordonnateur-de-projet-a-lasd-paalga/",
            "deadlineDate": "2026-07-26" 
        }
    ];

    const currentDate = new Date("2026-06-29");

    // Récupérer la liste des jobs (locale ou Supabase)
    async function getActiveJobsList() {
        if (supabase) {
            try {
                const { data, error } = await supabase.from('jobs').select('*');
                if (data && data.length > 0) {
                    // Vérifier si la base contient d'anciennes URLs de simulation (qui renvoient des 404)
                    const hasBrokenUrls = data.some(j => j.url && (j.url.includes('.html') || j.url.includes('chauffeur_livreur_oua') || j.url.includes('secretaire_bobo') || j.url.includes('permalink.php') || j.url === 'https://emploi.lefaso.net' || j.url === 'https://facebook.com'));
                    if (hasBrokenUrls) {
                        console.log("🌱 Détection de liens obsolètes. Lancement de la correction automatique sur Supabase...");
                        const jobsToUpsert = SIMULATED_LOCAL_JOBS.map(j => ({
                            id: j.id,
                            title: j.title,
                            company: j.company,
                            location: j.location,
                            description: j.description,
                            source: j.source,
                            url: j.url,
                            deadline_date: j.deadlineDate
                        }));
                        await supabase.from('jobs').upsert(jobsToUpsert);
                        console.log("🌱 Base de données Supabase mise à jour avec succès !");
                        
                        // Recharger les données fraîches
                        const { data: freshData } = await supabase.from('jobs').select('*');
                        if (freshData) {
                            return freshData.map(j => ({
                                id: j.id,
                                title: j.title,
                                company: j.company,
                                location: j.location,
                                description: j.description,
                                source: j.source,
                                url: j.url,
                                deadlineDate: j.deadline_date,
                                isPinned: j.is_pinned || false,
                                scrapedAt: j.scraped_at || ""
                            })).sort((a, b) => {
                                if (a.isPinned && !b.isPinned) return -1;
                                if (!a.isPinned && b.isPinned) return 1;
                                const aTime = a.scrapedAt ? new Date(a.scrapedAt).getTime() : 0;
                                const bTime = b.scrapedAt ? new Date(b.scrapedAt).getTime() : 0;
                                return bTime - aTime;
                            });
                        }
                    }

                    return data.map(j => ({
                        id: j.id,
                        title: j.title,
                        company: j.company,
                        location: j.location,
                        description: j.description,
                        source: j.source,
                        url: j.url,
                        deadlineDate: j.deadline_date,
                        isPinned: j.is_pinned || false,
                        scrapedAt: j.scraped_at || ""
                    })).sort((a, b) => {
                        if (a.isPinned && !b.isPinned) return -1;
                        if (!a.isPinned && b.isPinned) return 1;
                        const aTime = a.scrapedAt ? new Date(a.scrapedAt).getTime() : 0;
                        const bTime = b.scrapedAt ? new Date(b.scrapedAt).getTime() : 0;
                        return bTime - aTime;
                    });
                } else if (data && data.length === 0) {
                    console.log("🌱 Supabase vide. Seeding automatique des offres d'emploi...");
                    const jobsToSeed = SIMULATED_LOCAL_JOBS.map(j => ({
                        id: j.id,
                        title: j.title,
                        company: j.company,
                        location: j.location,
                        description: j.description,
                        source: j.source,
                        url: j.url,
                        deadline_date: j.deadlineDate
                    }));
                    await supabase.from('jobs').insert(jobsToSeed);
                    console.log("🌱 Seeding Supabase terminé !");
                }
            } catch (err) {
                console.warn("⚠️ Supabase jobs inaccessible, chargement secours local.", err);
            }
        }
        return SIMULATED_LOCAL_JOBS;
    }


    // --- INITIALISATION DE LA GRILLE D'ACCUEIL AVEC LES 4 DERNIERS JOBS ---
    async function initHomeJobsGrid() {
        const homeJobsGrid = document.getElementById('home-jobs-grid');
        if (!homeJobsGrid) return;
        
        homeJobsGrid.innerHTML = '';
        const jobsList = await getActiveJobsList();
        
        // Prendre les 4 premières offres (qui contiennent les épinglées en premier)
        const activeJobs = jobsList.filter(job => new Date(job.deadlineDate) >= currentDate);
        const latestJobs = activeJobs.slice(0, 4); 

        latestJobs.forEach(job => {
            const card = document.createElement('div');
            card.className = job.isPinned ? "home-job-card job-pinned" : "home-job-card";
            card.setAttribute('data-job-title', job.title);

            let dateLimitStr = "Non spécifiée";
            if (job.deadlineDate) {
                const parts = job.deadlineDate.split('-');
                const months = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juill.", "août", "sept.", "oct.", "nov.", "déc."];
                dateLimitStr = `${parts[2]} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
            }

            card.innerHTML = `
                <div class="home-job-header">
                    <div>
                        <h4 class="home-job-title">${job.title}</h4>
                        <div class="home-job-company">${job.company}</div>
                    </div>
                    <span class="home-job-score">94% match IA</span>
                </div>
                <p class="home-job-desc">${job.description.substring(0, 100)}...</p>
                <div class="home-job-footer">
                    <span class="home-job-loc"><i class="fa-solid fa-location-dot"></i> ${job.location}</span>
                    <span>Limite : ${dateLimitStr}</span>
                    <span class="home-job-click-action">Voir l'offre <i class="fa-solid fa-arrow-right"></i></span>
                </div>
            `;
            homeJobsGrid.appendChild(card);
        });
    }


    // Global variable to hold clicked job title for prefilling
    let clickedJobTitle = "";

    // DOM references for RegWall modal
    const regwallModal = document.getElementById('regwall-modal');
    const btnRegwallConfirm = document.getElementById('btn-regwall-confirm');
    const btnRegwallClose = document.getElementById('btn-regwall-close');

    if (btnRegwallConfirm) {
        btnRegwallConfirm.addEventListener('click', () => {
            if (regwallModal) regwallModal.classList.remove('open');
            switchTab('tab-register');
            if (clickedJobTitle) {
                document.getElementById('jobtitle').value = clickedJobTitle;
                document.getElementById('jobtitle').focus();
            }
        });
    }

    if (btnRegwallClose) {
        btnRegwallClose.addEventListener('click', () => {
            if (regwallModal) regwallModal.classList.remove('open');
        });
    }

    // Gestion du clic sur les offres d'emploi de la page d'accueil
    document.addEventListener('click', (e) => {
        const homeCard = e.target.closest('.home-job-card');
        if (homeCard) {
            const jobTitle = homeCard.getAttribute('data-job-title');
            clickedJobTitle = jobTitle;
            
            if (profile) {
                // Redirection fluide vers la recherche directe
                switchTab('tab-search');
                const searchTitleInput = document.getElementById('search-title');
                if (searchTitleInput) {
                    searchTitleInput.value = jobTitle;
                }
                const btnRunSearch = document.getElementById('btn-run-search');
                if (btnRunSearch) {
                    setTimeout(() => {
                        btnRunSearch.click();
                    }, 300);
                }
            } else {
                if (regwallModal) regwallModal.classList.add('open');
            }
        }
        
        // Gérer le clic sur le bouton d'inscription depuis les cartes
        const btnRegwallTriggerCard = e.target.closest('.btn-regwall-trigger-card');
        if (btnRegwallTriggerCard) {
            const jobTitle = btnRegwallTriggerCard.getAttribute('data-job-title');
            clickedJobTitle = jobTitle;
            if (regwallModal) regwallModal.classList.add('open');
        }
    });


    // 4. Job Card Generation Helper
    function createJobCard(match, showSendButton = true) {
        const card = document.createElement('div');
        card.className = match.job.isPinned ? "job-card-wrapper job-pinned" : "job-card-wrapper";
        
        let sendBtnHtml = "";
        const isUserRegistered = profile !== null;

        if (showSendButton) {
            if (isUserRegistered) {
                sendBtnHtml = `
                    <button type="button" class="btn-send-link" data-job-url="${match.job.url}" data-job-title="${match.job.title}">
                        <i class="fa-solid fa-paper-plane"></i> Recevoir le lien pour postuler par WhatsApp ou Email
                    </button>
                `;
            } else {
                sendBtnHtml = `
                    <button type="button" class="btn-regwall-trigger-card" data-job-title="${match.job.title}" style="background: var(--primary-color) !important; color: white !important; cursor: pointer; border: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.3s ease;">
                        <i class="fa-solid fa-user-plus"></i> S'inscrire gratuitement pour postuler
                    </button>
                `;
            }
        }

        let dateLimitStr = "Non spécifiée";
        if (match.job.deadlineDate) {
            const parts = match.job.deadlineDate.split('-');
            const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
            dateLimitStr = `${parts[2]} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
        }

        const sourceDisplayHtml = isUserRegistered 
            ? `<span><i class="fa-solid fa-globe"></i> ${match.job.source}</span>`
            : `<span><i class="fa-solid fa-lock text-gold"></i> Source : Masquée (Inscription requise)</span>`;

        const jobDescriptionHtml = isUserRegistered
            ? match.job.description
            : match.job.description.substring(0, 150) + `... <strong style="color: var(--primary-color); cursor: pointer;" class="btn-regwall-trigger-card" data-job-title="${match.job.title}">(S'inscrire pour voir tous les détails)</strong>`;

        card.innerHTML = `
            <div class="job-card-header">
                <div>
                    <h4 class="job-card-title">${match.job.title}</h4>
                    <div class="job-card-company">${match.job.company}</div>
                </div>
                <span class="score-badge">${match.score}% match IA</span>
            </div>
            <div class="job-card-details">
                <p>${jobDescriptionHtml}</p>
            </div>
            <div class="matched-job-exp" style="margin-top: 15px;">
                <strong>Analyse de l'IA (en français simple) :</strong> ${match.explanation}
            </div>
            <div class="job-card-meta">
                <div class="job-card-loc-src">
                    <span><i class="fa-solid fa-location-dot"></i> ${match.job.location}</span>
                    ${sourceDisplayHtml}
                    <span><i class="fa-solid fa-calendar-days"></i> Limite : ${dateLimitStr}</span>
                </div>
            </div>
            ${sendBtnHtml}
        `;
        return card;
    }


    // 5. Job Search Engine Logic (Recherche Directe)
    const btnRunSearch = document.getElementById('btn-run-search');
    const searchJobsList = document.getElementById('search-jobs-list');
    const searchPaywall = document.getElementById('search-paywall');
    const resultsCountText = document.getElementById('results-count-text');

    btnRunSearch.addEventListener('click', async () => {
        const searchTitleRaw = document.getElementById('search-title').value.trim().toLowerCase();
        const searchLoc = document.getElementById('search-location').value.trim().toLowerCase();

        if (!searchTitleRaw && !searchLoc) {
            showToast("Veuillez saisir ce que vous cherchez (Ex: Chauffeur, Secrétaire, Humanitaire) !", "error");
            return;
        }

        btnRunSearch.disabled = true;
        btnRunSearch.textContent = "Analyse...";
        searchJobsList.innerHTML = '';
        searchPaywall.classList.add('hidden');
        resultsCountText.textContent = "Le robot intelligent recherche dans la base burkinabè...";

        const jobsList = await getActiveJobsList();

        setTimeout(() => {
            btnRunSearch.disabled = false;
            btnRunSearch.textContent = "Rechercher";

            const matches = [];
            
            // Découper la recherche par virgule pour gérer les profils polyvalents
            const searchTerms = searchTitleRaw.split(',').map(t => t.trim()).filter(t => t.length > 0);

            jobsList.forEach(job => {
                const limit = new Date(job.deadlineDate);
                if (limit < currentDate) return;

                const jobTitle = job.title.toLowerCase();
                const jobLoc = job.location.toLowerCase();
                const jobDesc = job.description.toLowerCase();
                
                // Si l'un des mots-clés correspond au titre ou à la description
                const titleMatch = searchTerms.length === 0 || searchTerms.some(term => jobTitle.includes(term) || jobDesc.includes(term));
                const locMatch = !searchLoc || jobLoc.includes(searchLoc);

                if (titleMatch && locMatch) {
                    let score = 75;
                    let explanation = `Ce poste de ${job.title} correspond à vos capacités. La ville de ${job.location} est indiquée pour ce poste.`;
                    
                    // On prend le premier terme recherché pour adapter le message de l'IA
                    const matchedTerm = searchTerms.find(term => jobTitle.includes(term) || jobDesc.includes(term)) || (searchTerms[0] || "");
                    
                    if (matchedTerm.includes("bureau") || matchedTerm.includes("agent") || matchedTerm.includes("secr") || matchedTerm.includes("assist")) {
                        if (jobTitle.includes("bureau") || jobTitle.includes("secr") || jobTitle.includes("assist")) {
                            score = 95;
                            explanation = "L'IA valide ce poste : vos critères d'organisation et de secrétariat conviennent parfaitement aux tâches administratives de ce bureau.";
                        }
                    } else if (matchedTerm.includes("recouvrement") || matchedTerm.includes("comptable") || matchedTerm.includes("compte")) {
                        if (jobTitle.includes("recouvrement") || jobTitle.includes("comptable")) {
                            score = 92;
                            explanation = "Matching très fort. L'IA note que la rigueur demandée pour les déclarations fiscales ou la caisse s'accorde bien avec votre profil.";
                        }
                    } else if (matchedTerm.includes("communication") || matchedTerm.includes("publici")) {
                        if (jobTitle.includes("communication") || jobTitle.includes("publici")) {
                            score = 88;
                            explanation = "L'IA confirme votre aptitude pour ce rôle de direction de service ou de gestion commerciale dans la communication.";
                        }
                    } else if (matchedTerm.includes("chauffeur") || matchedTerm.includes("livreur") || matchedTerm.includes("condui")) {
                        if (jobTitle.includes("chauffeur") || jobTitle.includes("livreur")) {
                            score = 94;
                            explanation = "L'IA valide ce poste de chauffeur. Votre permis et votre expérience de conduite de véhicules de sécurité ou de fret sont idéaux.";
                        }
                    } else if (matchedTerm.includes("serve") || matchedTerm.includes("maquis") || matchedTerm.includes("restau")) {
                        if (jobTitle.includes("serve") || jobTitle.includes("maquis")) {
                            score = 90;
                            explanation = "Matching IA validé. Poste de serveuse en maquis correspondant à vos critères d'accueil.";
                        }
                    } else if (matchedTerm.includes("humanitaire") || matchedTerm.includes("ong") || matchedTerm.includes("projet") || matchedTerm.includes("nutrition")) {
                        if (jobTitle.includes("humanitaire") || jobTitle.includes("nutrition") || jobTitle.includes("chauffeur")) {
                            score = 91;
                            explanation = "Matching IA : profil adapté aux interventions d'urgence et à la rigueur logistique requise par les ONG.";
                        }
                    } else if (matchedTerm.includes("mine") || matchedTerm.includes("techni") || matchedTerm.includes("chantier")) {
                        if (jobTitle.includes("mine") || jobTitle.includes("chantier")) {
                            score = 89;
                            explanation = "Matching IA : profil technique opérationnel adapté aux contraintes de sécurité et de supervision sur site isolé.";
                        }
                    } else if (matchedTerm.includes("conseiller") || matchedTerm.includes("clientele") || matchedTerm.includes("microfinance") || matchedTerm.includes("credit")) {
                        if (jobTitle.includes("conseiller") || jobTitle.includes("clientele") || jobTitle.includes("microfinance")) {
                            score = 93;
                            explanation = "Matching IA : profil de conseiller clientèle idéal pour la microfinance et la gestion de crédits aux micro-entrepreneurs.";
                        }
                    }

                    matches.push({ job, score, explanation });
                }
            });

            if (matches.length === 0) {
                resultsCountText.textContent = "Aucun emploi actif correspondant trouvé.";
                searchJobsList.innerHTML = `
                    <div class="no-match-card">
                        <i class="fa-solid fa-face-frown" style="font-size: 1.8rem; color: var(--text-secondary); margin-bottom: 8px;"></i>
                        <p>Désolé, aucune offre active aujourd'hui pour "${searchTitle || ''}". Le robot continue ses recherches.</p>
                    </div>
                `;
                return;
            }

            resultsCountText.textContent = `${matches.length} offre(s) active(s) trouvée(s) et validée(s) par l'IA`;

            if (profile) {
                searchJobsList.classList.remove('blurred-active');
            } else {
                searchJobsList.classList.add('blurred-active');
            }

            matches.forEach((match) => {
                const card = createJobCard(match, true);
                searchJobsList.appendChild(card);
            });

            if (!profile && matches.length > 3) {
                searchPaywall.classList.remove('hidden');
                setTimeout(() => {
                    const cards = document.querySelectorAll('#search-jobs-list .job-card-wrapper');
                    if (cards.length >= 3) {
                        const topPos = cards[0].offsetHeight + cards[1].offsetHeight + cards[2].offsetHeight + 120;
                        searchPaywall.style.top = `${topPos}px`;
                        searchPaywall.style.height = `calc(100% - ${topPos}px)`;
                    }
                }, 100);
            }

        }, 1000);
    });


    // 6. Registration & Immediate Active Job Matching
    const form = document.getElementById('profile-form');
    const submitBtn = document.getElementById('submit-btn');
    const registerResultsSection = document.getElementById('register-results-section');
    const registerJobsList = document.getElementById('register-jobs-list');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fullname = document.getElementById('fullname').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const location = document.getElementById('location').value.trim();
        const jobtitle = document.getElementById('jobtitle').value.trim();
        const cvtext = document.getElementById('cvtext').value.trim();
        const notifyEmail = document.getElementById('notify-email').checked;
        const notifyWhatsapp = document.getElementById('notify-whatsapp').checked;

        if (notifyWhatsapp && !phone) {
            showToast("Veuillez entrer votre numéro WhatsApp pour recevoir les messages !", "error");
            return;
        }

        if (!notifyEmail && !notifyWhatsapp) {
            showToast("Veuillez choisir au moins un moyen d'alerte (Email ou WhatsApp) !", "error");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Analyse de votre profil par l\'IA...</span><i class="fa-solid fa-spinner fa-spin"></i>';

        const rawId = profile ? profile.id : "user_" + Date.now();
        profile = {
            id: rawId,
            fullname,
            email,
            phone,
            location,
            jobtitle,
            cvtext,
            notifyEmail,
            notifyWhatsapp,
            subscriptionStatus: daysRemaining > 0 ? subscriptionStatus : "Gratuit",
            subscriptionDaysRemaining: daysRemaining,
            createdAt: profile ? profile.createdAt : new Date().toISOString()
        };

        localStorage.setItem('user_profile', JSON.stringify(profile));
        localStorage.setItem('user_id', profile.id);

        // SYNCHRONISATION SUPABASE
        if (supabase) {
            try {
                const userPayload = {
                    id: profile.id,
                    fullname: profile.fullname,
                    email: profile.email,
                    phone: profile.phone,
                    location: profile.location,
                    jobtitle: profile.jobtitle,
                    cvtext: profile.cvtext,
                    notify_email: profile.notifyEmail,
                    notify_whatsapp: profile.notifyWhatsapp,
                    subscription_status: profile.subscriptionStatus,
                    subscription_days_remaining: profile.subscriptionDaysRemaining,
                    created_at: profile.createdAt
                };
                const { error } = await supabase.from('users').upsert(userPayload);
                if (error) console.error("Supabase upsert error:", error);
            } catch (err) {
                console.warn("⚠️ Synchro Supabase échouée.", err);
            }
        }

        const jobsList = await getActiveJobsList();

        setTimeout(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Terminer mon inscription gratuite</span><i class="fa-solid fa-arrow-right"></i>';
            showToast("Inscription gratuite terminée ! Déblocage complet des offres...", "success");
            
            updateGlobalUI();

            // Redirection fluide pour afficher immédiatement les détails débloqués de l'offre
            const targetTitle = clickedJobTitle || profile.jobtitle;
            setTimeout(() => {
                switchTab('tab-search');
                const searchTitleInput = document.getElementById('search-title');
                if (searchTitleInput) {
                    searchTitleInput.value = targetTitle;
                }
                const btnRunSearch = document.getElementById('btn-run-search');
                if (btnRunSearch) {
                    btnRunSearch.click();
                }
            }, 800);

            registerJobsList.innerHTML = '';
            const matches = [];

            jobsList.forEach(job => {
                const limit = new Date(job.deadlineDate);
                if (limit < currentDate) return;

                const userKeywords = profile.jobtitle.toLowerCase().split(',').map(t => t.trim()).filter(t => t.length > 0);
                const jobTitleLower = job.title.toLowerCase();
                const jobDescLower = job.description.toLowerCase();
                
                const keywordMatch = userKeywords.some(term => {
                    const words = term.split(/\s+/).filter(w => w.length > 3);
                    if (words.length === 0) {
                        return jobTitleLower.includes(term) || jobDescLower.includes(term);
                    }
                    return words.some(word => jobTitleLower.includes(word) || jobDescLower.includes(word));
                });

                if (keywordMatch) {
                    let score = 80;
                    let explanation = `Ce poste actif correspond à votre recherche de ${profile.jobtitle}. Vos compétences correspondent.`;

                    if (jobTitleLower.includes("bureau") || jobTitleLower.includes("secr") || jobTitleLower.includes("assist")) {
                        score = 95;
                        explanation = "L'IA valide ce poste : votre profil convient parfaitement pour ce poste administratif ou de secrétariat.";
                    } else if (jobTitleLower.includes("recouvrement") || jobTitleLower.includes("comptable")) {
                        score = 92;
                        explanation = "Matching fort. La rigueur demandée pour le suivi comptable ou de caisse s'accorde bien avec votre profil.";
                    } else if (jobTitleLower.includes("chauffeur") || jobTitleLower.includes("livreur")) {
                        score = 94;
                        explanation = "L'IA valide ce poste de chauffeur. Vos permis de conduire et votre expérience de route correspondent à l'offre.";
                    } else if (jobTitleLower.includes("serve") || jobTitleLower.includes("maquis")) {
                        score = 90;
                        explanation = "L'IA confirme votre aptitude pour ce poste de serveuse en maquis.";
                    } else if (jobTitleLower.includes("nutrition") || jobTitleLower.includes("humanitaire")) {
                        score = 91;
                        explanation = "L'IA valide votre profil humanitaire pour cette ONG de terrain.";
                    } else if (jobTitleLower.includes("mine") || jobTitleLower.includes("superviseur")) {
                        score = 89;
                        explanation = "L'IA valide vos aptitudes techniques de supervision de chantier minier.";
                    } else if (jobTitleLower.includes("conseiller") || jobTitleLower.includes("microfinance")) {
                        score = 93;
                        explanation = "L'IA valide votre profil commercial et financier pour cette institution de crédit.";
                    }

                    matches.push({ job, score, explanation });
                }
            });

            if (matches.length > 0) {
                registerResultsSection.classList.remove('hidden');
                
                matches.forEach((match) => {
                    const card = createJobCard(match, true);
                    registerJobsList.appendChild(card);
                });

                registerResultsSection.scrollIntoView({ behavior: 'smooth' });
            } else {
                registerResultsSection.classList.remove('hidden');
                registerJobsList.innerHTML = `
                    <div class="no-match-card">
                        <p>Aucune offre d'emploi active ne correspond à votre métier actuellement. Le robot continue ses recherches.</p>
                    </div>
                `;
                registerResultsSection.scrollIntoView({ behavior: 'smooth' });
            }

        }, 1500);
    });


    // 7. Click Handler for Send Link Button (Bouton Envoyer le lien)
    document.addEventListener('click', async (e) => {
        const btnSend = e.target.closest('.btn-send-link');
        if (btnSend) {
            const jobUrl = btnSend.getAttribute('data-job-url');
            const jobTitle = btnSend.getAttribute('data-job-title');

            if (!profile) {
                showToast("Inscription requise : créez votre profil gratuit pour recevoir les coordonnées !", "error");
                
                setTimeout(() => {
                    switchTab('tab-register');
                }, 1000);
                return;
            }

            if (daysRemaining <= 0) {
                showToast("Forfait Premium requis pour recevoir les coordonnées de l'offre !", "error");
                setTimeout(() => {
                    switchTab('tab-profile');
                    const pricingSection = document.getElementById('pricing-section');
                    if (pricingSection) {
                        pricingSection.scrollIntoView({ behavior: 'smooth' });
                    }
                }, 1000);
                return;
            }

            btnSend.disabled = true;
            btnSend.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Envoi en cours...';

            // OPTIONAL: LOG NOTIFICATION IN SUPABASE
            if (supabase && profile) {
                try {
                    const jobsList = await getActiveJobsList();
                    const jobMatch = jobsList.find(j => j.url === jobUrl);
                    if (jobMatch) {
                        await supabase.from('notifications').insert({
                            id: `notif_${profile.id}_${jobMatch.id}_${Date.now()}`,
                            user_id: profile.id,
                            job_id: jobMatch.id,
                            score: 94,
                            sent_at: new Date().toISOString()
                        });
                    }
                } catch (err) {
                    console.warn("Synchro notif Supabase échouée.", err);
                }
            }

            setTimeout(() => {
                btnSend.disabled = false;
                btnSend.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Lien envoyé !';
                
                let destination = "votre messagerie";
                if (profile.notifyWhatsapp && profile.phone) {
                    destination = `WhatsApp (${profile.phone})`;
                    const cleanPhone = profile.phone.replace(/[^0-9+]/g, ''); // Nettoyer les espaces
                    const message = `Bonjour ${profile.fullname} ! Voici le lien de candidature pour l'offre "${jobTitle}" : ${jobUrl}`;
                    const whatsappUrl = `https://api.whatsapp.com/send?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(message)}`;
                    window.open(whatsappUrl, '_blank');
                } else if (profile.notifyEmail && profile.email) {
                    destination = `Email (${profile.email})`;
                    const mailtoUrl = `mailto:${encodeURIComponent(profile.email)}?subject=${encodeURIComponent("Lien de candidature - " + jobTitle)}&body=${encodeURIComponent("Bonjour " + profile.fullname + ",\n\nVoici le lien de candidature pour l'offre de " + jobTitle + " :\n\n" + jobUrl + "\n\nBonne chance !\nL'équipe carréemploie")}`;
                    window.location.href = mailtoUrl;
                }
                
                showToast(`Le lien de candidature pour "${jobTitle}" a été envoyé sur ${destination} !`, "success");
            }, 1000);
        }
    });


    // 8. Simulated Payments / Subscriptions Handler (Mon Espace)
    const buyButtons = document.querySelectorAll('.btn-buy-plan');

    buyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const planType = button.getAttribute('data-plan');
            let planName = '';
            let daysToGive = 0;
            let planPrice = '';

            if (planType === 'monthly') {
                planName = 'Premium Mensuel';
                daysToGive = 30;
                planPrice = '5 000 FCFA';
            } else if (planType === 'semi-annual') {
                planName = 'Premium 6 Mois';
                daysToGive = 180;
                planPrice = '25 000 FCFA';
            } else if (planType === 'annual') {
                planName = 'Premium Annuel';
                daysToGive = 365;
                planPrice = '40 000 FCFA';
            }

            button.disabled = true;
            button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Traitement...';

            setTimeout(async () => {
                subscriptionStatus = planName;
                daysRemaining = daysToGive;

                localStorage.setItem('sub_status', subscriptionStatus);
                localStorage.setItem('sub_days', daysRemaining.toString());

                if (profile) {
                    profile.subscriptionStatus = subscriptionStatus;
                    profile.subscriptionDaysRemaining = daysRemaining;
                    localStorage.setItem('user_profile', JSON.stringify(profile));
                }

                // SYNCHRONISATION SUPABASE FORFAIT
                if (supabase && profile) {
                    try {
                        const { error } = await supabase.from('users').update({
                            subscription_status: subscriptionStatus,
                            subscription_days_remaining: daysRemaining
                        }).eq('id', profile.id);
                        if (error) console.error("Supabase update error:", error);
                    } catch (err) {
                        console.warn("⚠️ Synchro forfait Supabase échouée.", err);
                    }
                }

                updateGlobalUI();
                showToast(`Paiement de ${planPrice} validé ! Abonnement ${planName} activé.`, "success");

                button.disabled = false;
                if (planType === 'monthly') {
                    button.textContent = "S'abonner (5 000 FCFA)";
                } else if (planType === 'semi-annual') {
                    button.textContent = "S'abonner (25 000 FCFA)";
                } else if (planType === 'annual') {
                    button.textContent = "S'abonner (40 000 FCFA)";
                }

                // Force refresh home jobs grid
                initHomeJobsGrid();

                const currentSearchJobs = document.querySelectorAll('#search-jobs-list .job-card-wrapper');
                if (currentSearchJobs.length > 0) {
                    btnRunSearch.click();
                }
                
                if (profile) {
                    const registerActiveTab = document.getElementById('tab-register');
                    if (registerActiveTab.classList.contains('active')) {
                        const activeResults = document.getElementById('register-results-section');
                        if (!activeResults.classList.contains('hidden')) {
                            document.getElementById('profile-form').dispatchEvent(new Event('submit'));
                        }
                    }
                }

                searchJobsList.classList.remove('blurred-active');
                searchPaywall.classList.add('hidden');

                setTimeout(() => {
                    switchTab('tab-search');
                }, 1000);

            }, 1500);
        });
    });


    // --- 9. CHARGEMENT ASYNCHRONE INITIAL DES DONNÉES SUPABASE CANDIDAT ---
    async function loadInitialSupabaseData() {
        const userId = localStorage.getItem('user_id');
        if (supabase && userId) {
            try {
                const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
                if (data) {
                    profile = {
                        id: data.id,
                        fullname: data.fullname,
                        email: data.email,
                        phone: data.phone,
                        location: data.location,
                        jobtitle: data.jobtitle,
                        cvtext: data.cvtext,
                        notifyEmail: data.notify_email,
                        notifyWhatsapp: data.notify_whatsapp,
                        subscriptionStatus: data.subscription_status,
                        subscriptionDaysRemaining: data.subscription_days_remaining,
                        createdAt: data.created_at
                    };
                    subscriptionStatus = data.subscription_status;
                    daysRemaining = data.subscription_days_remaining;
                    
                    localStorage.setItem('user_profile', JSON.stringify(profile));
                    localStorage.setItem('sub_status', subscriptionStatus);
                    localStorage.setItem('sub_days', daysRemaining.toString());
                }
            } catch (err) {
                console.warn("Erreur de chargement Supabase initial:", err);
            }
        }
        
        updateGlobalUI();
        initHomeJobsGrid();
    }

    loadInitialSupabaseData();


    // Toast helper
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    function showToast(message, type = "success") {
        toastMessage.textContent = message;
        toast.className = "toast";
        
        if (type === "error") {
            toast.style.borderColor = "var(--accent-error)";
            toast.querySelector('.toast-icon').className = "fa-solid fa-circle-exclamation toast-icon";
            toast.querySelector('.toast-icon').style.color = "var(--accent-error)";
        } else {
            toast.style.borderColor = "var(--primary-color)";
            toast.querySelector('.toast-icon').className = "fa-solid fa-circle-check toast-icon";
            toast.querySelector('.toast-icon').style.color = "var(--primary-color)";
        }
        
        toast.classList.remove('hidden');

        setTimeout(() => {
            toast.classList.add('hidden');
        }, 4000);
    }
});
