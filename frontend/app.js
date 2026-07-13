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

    function prefillProfileForm() {
        if (profile) {
            const fullnameEl = document.getElementById('fullname');
            const emailEl = document.getElementById('email');
            const phoneEl = document.getElementById('phone');
            const locationEl = document.getElementById('location');
            const cvtextEl = document.getElementById('cvtext');
            const notifyEmailEl = document.getElementById('notify-email');
            const notifyWhatsappEl = document.getElementById('notify-whatsapp');
            const jobtitle1El = document.getElementById('jobtitle-1');
            const jobtitle2El = document.getElementById('jobtitle-2');
            const jobtitle3El = document.getElementById('jobtitle-3');
            const jobtitleEl = document.getElementById('jobtitle');

            if (fullnameEl) fullnameEl.value = profile.fullname || "";
            if (emailEl) emailEl.value = profile.email || "";
            if (phoneEl) phoneEl.value = profile.phone || "";
            if (locationEl) locationEl.value = profile.location || "";
            if (cvtextEl) cvtextEl.value = profile.cvtext || "";
            if (notifyEmailEl) notifyEmailEl.checked = profile.notifyEmail !== false;
            if (notifyWhatsappEl) notifyWhatsappEl.checked = profile.notifyWhatsapp === true;

            const titles = profile.jobtitle ? profile.jobtitle.split(',').map(t => t.trim()) : [];
            if (jobtitle1El) jobtitle1El.value = titles[0] || "";
            if (jobtitle2El) jobtitle2El.value = titles[1] || "";
            if (jobtitle3El) jobtitle3El.value = titles[2] || "";
            if (jobtitleEl) jobtitleEl.value = profile.jobtitle || "";
        }
    }

    function switchTab(tabId) {
        if (tabId === 'tab-register') {
            prefillProfileForm();
        }

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

    function formatDeadlineWithRemainingDays(deadlineDate, isShort = false) {
        if (!deadlineDate) return "Non spécifiée";
        
        try {
            const parts = deadlineDate.split('-');
            const months = isShort 
                ? ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juill.", "août", "sept.", "oct.", "nov.", "déc."]
                : ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
            const formattedDate = `${parts[2]} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
            
            const limitDateObj = new Date(deadlineDate + 'T00:00:00');
            const todayObj = new Date();
            todayObj.setHours(0, 0, 0, 0);
            
            const timeDiff = limitDateObj.getTime() - todayObj.getTime();
            const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
            
            if (daysDiff < 0) {
                return `${formattedDate} (Expirée)`;
            } else if (daysDiff === 0) {
                return `${formattedDate} (Dernier jour !)`;
            } else if (daysDiff === 1) {
                return `${formattedDate} (Il reste 1 jour)`;
            } else {
                return `${formattedDate} (Il reste ${daysDiff} jours)`;
            }
        } catch (e) {
            return deadlineDate;
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

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // Récupérer la liste des jobs (locale ou Supabase)
    async function getActiveJobsList() {
        if (supabase) {
            try {
                const { data, error } = await supabase.from('jobs').select('*');
                if (data && data.length > 0) {
                    const todayStr = new Date().toISOString().split('T')[0];
                    return data
                        .filter(j => !j.deadline_date || j.deadline_date >= todayStr)
                        .map(j => ({
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
                    console.log("🌱 Supabase vide. En attente de la collecte du robot.");
                }
            } catch (err) {
                console.warn("⚠️ Supabase jobs inaccessible.", err);
            }
        }
        return [];
    }


    // --- INITIALISATION DE LA GRILLE D'ACCUEIL AVEC TOUS LES JOBS ACTIFS ---
    let regularStartIndex = 0;
    const regularPageSize = 6;

    async function initHomeJobsGrid() {
        const homeJobsGrid = document.getElementById('home-jobs-grid');
        const loadMoreContainer = document.getElementById('load-more-container');
        if (!homeJobsGrid) return;
        
        homeJobsGrid.innerHTML = '';
        const jobsList = await getActiveJobsList();
        
        // Prendre toutes les offres actives non expirées et non en attente (sans préfixe pending_)
        const activeJobs = jobsList.filter(job => {
            const isNotExpired = new Date(job.deadlineDate) >= currentDate;
            const isNotPending = !job.id.startsWith('pending_');
            return isNotExpired && isNotPending;
        });

        // Séparer les offres épinglées des offres régulières
        const pinnedJobs = activeJobs.filter(job => job.isPinned);
        const regularJobs = activeJobs.filter(job => !job.isPinned);

        // Si le point de départ dépasse les offres disponibles, on boucle à 0
        if (regularStartIndex >= regularJobs.length) {
            regularStartIndex = 0;
        }

        const visibleRegularJobs = regularJobs.slice(regularStartIndex, regularStartIndex + regularPageSize);
        
        // Assembler la liste visible : Épinglées (fixes) + Régulières (tournantes)
        const visibleJobs = [...pinnedJobs, ...visibleRegularJobs];

        visibleJobs.forEach(job => {
            const card = document.createElement('div');
            card.className = job.isPinned ? "home-job-card job-pinned" : "home-job-card";
            card.setAttribute('data-job-title', job.title);

            const dateLimitStr = formatDeadlineWithRemainingDays(job.deadlineDate, true);

            card.innerHTML = `
                <div class="home-job-header">
                    <div>
                        <h4 class="home-job-title">${job.title}</h4>
                        <div class="home-job-company">${job.company}</div>
                    </div>
                    <span class="home-job-score">${job.isPinned ? '📌 À LA UNE' : '94% match IA'}</span>
                </div>
                <p class="home-job-desc">${job.description.substring(0, 120)}...</p>
                <div class="home-job-footer" style="border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 10px; margin-bottom: 10px;">
                    <span class="home-job-loc"><i class="fa-solid fa-location-dot"></i> ${job.location}</span>
                    <span>Limite : ${dateLimitStr}</span>
                </div>
                <button type="button" class="btn-detail-trigger" style="background: var(--primary-color); color: white; border: none; padding: 10px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.3s ease;">
                    Voir tous les détails <i class="fa-solid fa-arrow-right"></i>
                </button>
            `;
            homeJobsGrid.appendChild(card);
        });

        // Gérer le bouton de rotation "Voir plus d'offres" style diaporama
        if (loadMoreContainer) {
            loadMoreContainer.innerHTML = '';
            
            // On affiche les boutons de navigation s'il y a plus d'offres régulières que la taille d'une page (6)
            if (regularJobs.length > regularPageSize) {
                const navBtnGroup = document.createElement('div');
                navBtnGroup.style.display = 'flex';
                navBtnGroup.style.justifyContent = 'center';
                navBtnGroup.style.gap = '15px';
                navBtnGroup.style.marginTop = '10px';

                // Bouton Précédent (Retour aux offres déjà vues)
                const btnPrev = document.createElement('button');
                btnPrev.className = 'btn-admin-cancel';
                btnPrev.style.padding = '12px 24px';
                btnPrev.style.fontWeight = '600';
                btnPrev.style.border = '1px solid var(--panel-border)';
                btnPrev.style.borderRadius = '8px';
                btnPrev.style.cursor = 'pointer';
                btnPrev.style.background = 'var(--panel-border)';
                btnPrev.style.color = 'var(--text-primary)';
                btnPrev.innerHTML = '<i class="fa-solid fa-circle-chevron-left"></i> Offres précédentes';
                btnPrev.addEventListener('click', () => {
                    regularStartIndex -= regularPageSize;
                    if (regularStartIndex < 0) {
                        regularStartIndex = Math.max(0, Math.floor((regularJobs.length - 1) / regularPageSize) * regularPageSize);
                    }
                    initHomeJobsGrid();
                    const jobSection = document.querySelector('.latest-jobs-section');
                    if (jobSection) {
                        jobSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });

                // Bouton Suivant (Découverte de nouvelles offres)
                const btnNext = document.createElement('button');
                btnNext.className = 'btn-search';
                btnNext.style.padding = '12px 24px';
                btnNext.style.fontWeight = '600';
                btnNext.style.borderRadius = '8px';
                btnNext.style.cursor = 'pointer';
                btnNext.style.border = 'none';
                btnNext.style.background = 'var(--primary-color)';
                btnNext.style.color = 'white';
                btnNext.innerHTML = 'Découvrir d\'autres offres <i class="fa-solid fa-circle-chevron-right"></i>';
                btnNext.addEventListener('click', () => {
                    regularStartIndex += regularPageSize;
                    if (regularStartIndex >= regularJobs.length) {
                        regularStartIndex = 0;
                    }
                    initHomeJobsGrid();
                    const jobSection = document.querySelector('.latest-jobs-section');
                    if (jobSection) {
                        jobSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });

                navBtnGroup.appendChild(btnPrev);
                navBtnGroup.appendChild(btnNext);
                loadMoreContainer.appendChild(navBtnGroup);
            }
        }
    }


    // Global variable to hold clicked job title for prefilling
    let clickedJobTitle = "";

    // DOM references for RegWall modal
    const regwallModal = document.getElementById('regwall-modal');
    const regwallProfileForm = document.getElementById('regwall-profile-form');
    const regwallRecoverForm = document.getElementById('regwall-recover-form');

    const regRegisterView = document.getElementById('regwall-register-view');
    const regRecoverView = document.getElementById('regwall-recover-view');

    const btnGotoRecover = document.getElementById('btn-goto-recover');
    const btnGotoRegister = document.getElementById('btn-goto-register');

    // Navigation entre Inscription et Récupération
    if (btnGotoRecover) {
        btnGotoRecover.addEventListener('click', (e) => {
            e.preventDefault();
            if (regRegisterView) regRegisterView.classList.add('hidden');
            if (regRecoverView) regRecoverView.classList.remove('hidden');
        });
    }

    if (btnGotoRegister) {
        btnGotoRegister.addEventListener('click', (e) => {
            e.preventDefault();
            if (regRecoverView) regRecoverView.classList.add('hidden');
            if (regRegisterView) regRegisterView.classList.remove('hidden');
        });
    }

    // Fermeture de la modale Regwall (pour tous les boutons annuler/plus tard)
    const closeRegwallButtons = document.querySelectorAll('.btn-regwall-close-btn');
    closeRegwallButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (regwallModal) regwallModal.classList.remove('open');
            // Réinitialiser à la vue inscription par défaut pour la prochaine ouverture
            if (regRecoverView) regRecoverView.classList.add('hidden');
            if (regRegisterView) regRegisterView.classList.remove('hidden');
        });
    });

    // Inscription gratuite formulaire
    if (regwallProfileForm) {
        regwallProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fullname = document.getElementById('reg-fullname-free').value.trim();
            const email = document.getElementById('reg-email-free').value.trim();
            const phone = document.getElementById('reg-phone-free').value.trim();
            const location = document.getElementById('reg-location-free').value.trim();
            
            const jobtitle1 = document.getElementById('reg-job-1').value.trim();
            const jobtitle2 = document.getElementById('reg-job-2').value.trim();
            const jobtitle3 = document.getElementById('reg-job-3').value.trim();
            const jobtitleArr = [jobtitle1, jobtitle2, jobtitle3].map(t => t.trim()).filter(t => t.length > 0);
            const jobtitle = jobtitleArr.join(', ');

            // Anti-doublon : Recherche si un compte existe déjà avec cet e-mail ou ce numéro
            if (supabase) {
                try {
                    const { data: existingUsers, error: checkError } = await supabase
                        .from('users')
                        .select('*')
                        .or(`email.eq.${email},phone.eq.${phone}`);
                    
                    if (existingUsers && existingUsers.length > 0) {
                        const matchedUser = existingUsers[0];
                        profile = {
                            id: matchedUser.id,
                            fullname: matchedUser.fullname,
                            email: matchedUser.email,
                            phone: matchedUser.phone,
                            location: matchedUser.location,
                            jobtitle: matchedUser.jobtitle,
                            cvtext: matchedUser.cvtext,
                            notifyEmail: matchedUser.notify_email,
                            notifyWhatsapp: matchedUser.notify_whatsapp,
                            subscriptionStatus: matchedUser.subscription_status,
                            subscriptionDaysRemaining: matchedUser.subscription_days_remaining,
                            createdAt: matchedUser.created_at
                        };
                        subscriptionStatus = matchedUser.subscription_status;
                        daysRemaining = matchedUser.subscription_days_remaining;

                        localStorage.setItem('user_profile', JSON.stringify(profile));
                        localStorage.setItem('user_id', profile.id);
                        localStorage.setItem('sub_status', subscriptionStatus);
                        localStorage.setItem('sub_days', daysRemaining.toString());

                        updateGlobalUI();
                        showToast(`Ravi de vous revoir ${profile.fullname} ! Votre compte a été synchronisé.`, "success");
                        if (regwallModal) regwallModal.classList.remove('open');
                        if (clickedJobTitle) {
                            setTimeout(() => { openJobDetailsModalByTitle(clickedJobTitle); }, 400);
                        }
                        return;
                    }
                } catch (err) {
                    console.warn("Vérification doublon échouée :", err);
                }
            }

            profile = {
                id: "user_" + Date.now(),
                fullname,
                email,
                phone,
                location,
                jobtitle,
                cvtext: "",
                notifyEmail: true,
                notifyWhatsapp: true,
                subscriptionStatus: "Gratuit",
                subscriptionDaysRemaining: 0,
                createdAt: new Date().toISOString()
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
                    await supabase.from('users').upsert(userPayload);
                } catch (err) {
                    console.warn("⚠️ Synchro Supabase échouée.", err);
                }
            }

            updateGlobalUI();
            showToast("Inscription gratuite réussie ! Déblocage de l'offre...", "success");

            if (regwallModal) regwallModal.classList.remove('open');

            // Ouvrir directement la modale de détails de l'offre cliquée
            if (clickedJobTitle) {
                setTimeout(() => {
                    openJobDetailsModalByTitle(clickedJobTitle);
                }, 400);
            }
        });
    }

    // Récupération de profil formulaire
    if (regwallRecoverForm) {
        regwallRecoverForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const identity = document.getElementById('recover-identity').value.trim();

            if (!supabase) {
                showToast("Service indisponible en mode local.", "error");
                return;
            }

            const btnSubmit = document.getElementById('btn-recover-submit');
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Recherche...';
            }

            try {
                // Recherche par e-mail ou téléphone exact sur Supabase
                const { data: matchedUsers, error: matchError } = await supabase
                    .from('users')
                    .select('*')
                    .or(`email.eq.${identity},phone.eq.${identity}`);

                if (matchedUsers && matchedUsers.length > 0) {
                    const matchedUser = matchedUsers[0];
                    profile = {
                        id: matchedUser.id,
                        fullname: matchedUser.fullname,
                        email: matchedUser.email,
                        phone: matchedUser.phone,
                        location: matchedUser.location,
                        jobtitle: matchedUser.jobtitle,
                        cvtext: matchedUser.cvtext,
                        notifyEmail: matchedUser.notify_email,
                        notifyWhatsapp: matchedUser.notify_whatsapp,
                        subscriptionStatus: matchedUser.subscription_status,
                        subscriptionDaysRemaining: matchedUser.subscription_days_remaining,
                        createdAt: matchedUser.created_at
                    };
                    subscriptionStatus = matchedUser.subscription_status;
                    daysRemaining = matchedUser.subscription_days_remaining;

                    localStorage.setItem('user_profile', JSON.stringify(profile));
                    localStorage.setItem('user_id', profile.id);
                    localStorage.setItem('sub_status', subscriptionStatus);
                    localStorage.setItem('sub_days', daysRemaining.toString());

                    updateGlobalUI();
                    showToast(`Ravi de vous revoir ${profile.fullname} ! Votre profil a été récupéré.`, "success");

                    if (regwallModal) regwallModal.classList.remove('open');
                    
                    // Réinitialiser à la vue inscription par défaut pour la prochaine fois
                    if (regRecoverView) regRecoverView.classList.add('hidden');
                    if (regRegisterView) regRegisterView.classList.remove('hidden');

                    // Ouvrir directement les détails de l'offre cliquée
                    if (clickedJobTitle) {
                        setTimeout(() => {
                            openJobDetailsModalByTitle(clickedJobTitle);
                        }, 400);
                    }
                } else {
                    showToast("Aucun compte trouvé avec cet e-mail ou numéro.", "error");
                }
            } catch (err) {
                console.error(err);
                showToast("Erreur de communication avec la base de données.", "error");
            } finally {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Récupérer mon profil';
                }
            }
        });
    }

    // Fonction d'ouverture de la modale de détails d'une offre d'emploi
    async function openJobDetailsModalByTitle(jobTitle) {
        const jobsList = await getActiveJobsList();
        const job = jobsList.find(j => j.title === jobTitle);
        if (!job) return;

        document.getElementById('detail-job-title').textContent = job.title;
        document.getElementById('detail-job-company').textContent = job.company;
        document.getElementById('detail-job-location').innerHTML = `<i class="fa-solid fa-location-dot"></i> ${job.location}`;
        document.getElementById('detail-job-source').style.display = 'inline-block';
        document.getElementById('detail-job-source').innerHTML = `<i class="fa-solid fa-globe"></i> Source : ${job.source}`;
        
        const limitStr = formatDeadlineWithRemainingDays(job.deadlineDate, false);
        document.getElementById('detail-job-deadline').innerHTML = `<i class="fa-solid fa-calendar-days"></i> Limite : ${limitStr}`;
        const formattedDesc = job.description
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
        document.getElementById('detail-job-desc').innerHTML = formattedDesc;

        const btnApply = document.getElementById('btn-detail-apply');
        if (btnApply) {
            btnApply.setAttribute('data-job-url', job.url);
            btnApply.setAttribute('data-job-title', job.title);
        }

        const detailsModal = document.getElementById('job-details-modal');
        if (detailsModal) detailsModal.classList.add('open');
    }

    // Gestion du clic sur les offres d'emploi de la page d'accueil ou de recherche pour les détails
    document.addEventListener('click', async (e) => {
        const homeCard = e.target.closest('.home-job-card');
        const triggerBtn = e.target.closest('.btn-detail-trigger');
        
        if (homeCard || triggerBtn) {
            const cardElement = homeCard || (triggerBtn ? triggerBtn.closest('.home-job-card') : null);
            if (!cardElement) return;
            
            const jobTitle = cardElement.getAttribute('data-job-title');
            clickedJobTitle = jobTitle;
            
            if (profile) {
                await openJobDetailsModalByTitle(jobTitle);
            } else {
                if (regwallModal) {
                    regwallModal.classList.add('open');
                    const regJob1 = document.getElementById('reg-job-1');
                    if (regJob1) regJob1.value = jobTitle;
                }
            }
        }
        
        // Gérer le clic sur le bouton d'inscription depuis les cartes
        const btnRegwallTriggerCard = e.target.closest('.btn-regwall-trigger-card');
        if (btnRegwallTriggerCard) {
            const jobTitle = btnRegwallTriggerCard.getAttribute('data-job-title');
            clickedJobTitle = jobTitle;
            if (regwallModal) {
                regwallModal.classList.add('open');
                const regJob1 = document.getElementById('reg-job-1');
                if (regJob1) regJob1.value = jobTitle;
            }
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

        const dateLimitStr = formatDeadlineWithRemainingDays(match.job.deadlineDate, false);

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
                    let explanation = `Super opportunité ! Ce poste de "${job.title}" correspond bien à vos compétences et critères de recherche à ${job.location}. C'est le moment idéal pour postuler et valoriser votre parcours ! 🌟`;
                    
                    // On prend le premier terme recherché pour adapter le message de l'IA
                    const matchedTerm = searchTerms.find(term => jobTitle.includes(term) || jobDesc.includes(term)) || (searchTerms[0] || "");
                    
                    if (matchedTerm.includes("bureau") || matchedTerm.includes("agent") || matchedTerm.includes("secr") || matchedTerm.includes("assist")) {
                        if (jobTitle.includes("bureau") || jobTitle.includes("secr") || jobTitle.includes("assist")) {
                            score = 95;
                            explanation = "L'IA valide ce poste : votre sens de l'organisation et votre maîtrise des tâches de secrétariat s'accordent à merveille avec ce rôle de bureau. N'hésitez pas une seconde, vous avez toutes vos chances ! 💼";
                        }
                    } else if (matchedTerm.includes("recouvrement") || matchedTerm.includes("comptable") || matchedTerm.includes("compte")) {
                        if (jobTitle.includes("recouvrement") || jobTitle.includes("comptable")) {
                            score = 92;
                            explanation = "Matching très fort ! Votre rigueur pour le suivi comptable, les déclarations fiscales ou la caisse correspond précisément aux exigences de cette offre. Foncez, c'est une excellente étape pour votre carrière ! 📊";
                        }
                    } else if (matchedTerm.includes("communication") || matchedTerm.includes("publici")) {
                        if (jobTitle.includes("communication") || jobTitle.includes("publici")) {
                            score = 88;
                            explanation = "L'IA valide votre profil : vos capacités relationnelles et votre sens commercial conviennent parfaitement aux besoins de communication de cette structure. Saisissez cette superbe occasion ! 📣";
                        }
                    } else if (matchedTerm.includes("chauffeur") || matchedTerm.includes("livreur") || matchedTerm.includes("condui")) {
                        if (jobTitle.includes("chauffeur") || jobTitle.includes("livreur")) {
                            score = 94;
                            explanation = "Profil chauffeur validé avec brio ! Votre expérience de la conduite et vos permis de conduire répondent exactement aux besoins logistiques de ce recruteur. Postulez vite, vous avez le profil rêvé ! 🚚";
                        }
                    } else if (matchedTerm.includes("serve") || matchedTerm.includes("maquis") || matchedTerm.includes("restau")) {
                        if (jobTitle.includes("serve") || jobTitle.includes("maquis")) {
                            score = 90;
                            explanation = "Excellent matching ! Votre sens de l'accueil et votre dynamisme sont les atouts parfaits recherchés pour ce poste de serveuse en maquis. Préparez-vous à briller dans ce rôle ! 🍽️";
                        }
                    } else if (matchedTerm.includes("humanitaire") || matchedTerm.includes("ong") || matchedTerm.includes("projet") || matchedTerm.includes("nutrition")) {
                        if (jobTitle.includes("humanitaire") || jobTitle.includes("nutrition") || jobTitle.includes("chauffeur")) {
                            score = 91;
                            explanation = "Profil humanitaire idéal ! Votre réactivité et votre rigueur opérationnelle cadrent parfaitement avec les standards d'intervention de cette ONG. C'est une mission magnifique, lancez-vous ! 🌍";
                        }
                    } else if (matchedTerm.includes("mine") || matchedTerm.includes("techni") || matchedTerm.includes("chantier")) {
                        if (jobTitle.includes("mine") || jobTitle.includes("chantier")) {
                            score = 89;
                            explanation = "L'IA confirme vos aptitudes ! Vos compétences techniques et de supervision sont idéales pour relever les défis de ce poste sur site isolé. C'est un superbe challenge pour vous ! ⚒️";
                        }
                    } else if (matchedTerm.includes("conseiller") || matchedTerm.includes("clientele") || matchedTerm.includes("microfinance") || matchedTerm.includes("credit")) {
                        if (jobTitle.includes("conseiller") || jobTitle.includes("clientele") || jobTitle.includes("microfinance")) {
                            score = 93;
                            explanation = "Matching commercial fort ! Votre approche client et vos bases financières correspondent parfaitement à ce rôle clé dans la microfinance. Une belle évolution professionnelle vous attend ! 💰";
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
        
        const jobtitle1 = document.getElementById('jobtitle-1').value.trim();
        const jobtitle2 = document.getElementById('jobtitle-2').value.trim();
        const jobtitle3 = document.getElementById('jobtitle-3').value.trim();
        const jobtitleArr = [jobtitle1, jobtitle2, jobtitle3].map(t => t.trim()).filter(t => t.length > 0);
        const jobtitle = jobtitleArr.join(', ');
        
        const cvtext = "";
        const notifyEmail = true;
        const notifyWhatsapp = true;

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
                    let explanation = `Super opportunité ! Ce poste correspond bien à votre profil de recherche de "${profile.jobtitle}". Votre rigueur est un vrai atout. Tentez votre chance sans tarder ! 💪`;

                    if (jobTitleLower.includes("bureau") || jobTitleLower.includes("secr") || jobTitleLower.includes("assist")) {
                        score = 95;
                        explanation = "L'IA valide ce poste : votre rigueur administrative et votre sens du secrétariat conviennent parfaitement aux attentes de ce bureau. C'est le moment idéal pour postuler ! 💼";
                    } else if (jobTitleLower.includes("recouvrement") || jobTitleLower.includes("comptable")) {
                        score = 92;
                        explanation = "Matching très fort ! Vos compétences en comptabilité et gestion s'harmonisent idéalement avec les exigences rigoureuses de ce poste. Vous avez tout pour réussir ici ! 📊";
                    } else if (jobTitleLower.includes("chauffeur") || jobTitleLower.includes("livreur")) {
                        score = 94;
                        explanation = "Profil chauffeur validé ! Votre expérience routière et la validité de vos permis font de vous le candidat idéal pour cette mission de transport. N'hésitez pas, postulez ! 🚚";
                    } else if (jobTitleLower.includes("serve") || jobTitleLower.includes("maquis")) {
                        score = 90;
                        explanation = "Excellent matching ! Votre sens du service et votre dynamisme sont les atouts recherchés pour satisfaire la clientèle de ce maquis. Une belle mission en perspective ! 🍽️";
                    } else if (jobTitleLower.includes("nutrition") || jobTitleLower.includes("humanitaire")) {
                        score = 91;
                        explanation = "L'IA confirme votre profil ! Vos aptitudes logistiques ou médicales conviennent très bien pour mener à bien cette mission humanitaire. Donnez du sens à votre carrière, postulez ! 🌍";
                    } else if (jobTitleLower.includes("mine") || jobTitleLower.includes("superviseur")) {
                        score = 89;
                        explanation = "Matching technique excellent ! Votre expérience terrain de supervision convient parfaitement aux contraintes opérationnelles de ce site minier. Un défi passionnant à relever ! ⚒️";
                    } else if (jobTitleLower.includes("conseiller") || jobTitleLower.includes("microfinance")) {
                        score = 93;
                        explanation = "Matching commercial fort ! Votre goût pour le conseil financier s'accorde idéalement avec cette mission d'accompagnement de crédit. Lancez-vous, vous avez toutes vos chances ! 💰";
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


    // 8. Mobile Money Payment / Subscriptions Handler (Mon Espace)
    const buyButtons = document.querySelectorAll('.btn-buy-plan');
    const premiumSuccessModal = document.getElementById('premium-success-modal');
    const btnSuccessClose = document.getElementById('btn-success-close');

    buyButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const planType = button.getAttribute('data-plan');
            let planName = 'Premium Mensuel';
            let planPrice = '5 000 FCFA';

            if (planType === 'semi-annual' || planType === 'semi') {
                planName = 'Premium 6 Mois';
                planPrice = '25 000 FCFA';
            } else if (planType === 'annual') {
                planName = 'Premium Annuel';
                planPrice = '40 000 FCFA';
            }

            if (!profile) {
                showToast("Veuillez d'abord vous inscrire gratuitement avant de choisir un forfait Premium !", "error");
                if (regwallModal) regwallModal.classList.add('open');
                return;
            }

            const fullname = profile.fullname || "Non renseigné";
            const phone = profile.phone || "Non renseigné";
            const email = profile.email || "Non renseigné";

            const message = `Bonjour carréemploie, je suis ${fullname} (Tél: ${phone}, E-mail: ${email}). Je souhaite m'abonner au Forfait Premium "${planName}" (${planPrice}). Merci de me contacter pour valider mon paiement Mobile Money.`;
            
            // 1. Ouvrir WhatsApp avec les détails pré-remplis
            const waUrl = `https://wa.me/22656911674?text=${encodeURIComponent(message)}`;
            window.open(waUrl, '_blank');
            
            // 2. Ouvrir le mail pré-rempli à l'administrateur
            const mailtoUrl = `mailto:alfredkafando@gmail.com?subject=Demande Activation Premium - ${fullname}&body=${encodeURIComponent(message)}`;
            setTimeout(() => {
                window.open(mailtoUrl, '_blank');
            }, 800);

            // 3. Enregistrer l'état "Demande Premium" dans Supabase
            if (supabase && profile) {
                try {
                    await supabase.from('users').update({
                        subscription_status: `Demande ${planName}`
                    }).eq('id', profile.id);
                    console.log("⚡ Demande d'abonnement enregistrée dans Supabase.");
                } catch (err) {
                    console.warn("⚠️ Impossible d'enregistrer la demande sur Supabase :", err);
                }
            }

            // 4. Afficher le pop-up de succès final
            if (premiumSuccessModal) premiumSuccessModal.classList.add('open');
        });
    });

    if (btnSuccessClose) {
        btnSuccessClose.addEventListener('click', () => {
            if (premiumSuccessModal) premiumSuccessModal.classList.remove('open');
        });
    }

    // Gestionnaires de fermeture pour la modale Détails
    const btnCloseDetails = document.getElementById('btn-close-details');
    const btnDetailCancel = document.getElementById('btn-detail-cancel');
    const detailsModal = document.getElementById('job-details-modal');

    if (btnCloseDetails) {
        btnCloseDetails.addEventListener('click', () => {
            if (detailsModal) detailsModal.classList.remove('open');
        });
    }
    if (btnDetailCancel) {
        btnDetailCancel.addEventListener('click', () => {
            if (detailsModal) detailsModal.classList.remove('open');
        });
    }

    // Écouteur pour le clic sur le bouton de postulation de la modale détails
    const btnDetailApply = document.getElementById('btn-detail-apply');
    if (btnDetailApply) {
        btnDetailApply.addEventListener('click', async () => {
            const jobUrl = btnDetailApply.getAttribute('data-job-url');
            const jobTitle = btnDetailApply.getAttribute('data-job-title');
            
            if (detailsModal) detailsModal.classList.remove('open');

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

            btnDetailApply.disabled = true;
            const originalText = btnDetailApply.innerHTML;
            btnDetailApply.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Envoi en cours...';

            // Enregistrer la notification dans Supabase si connecté
            if (supabase && profile) {
                try {
                    const jobsList = await getActiveJobsList();
                    const jobMatch = jobsList.find(j => j.url === jobUrl);
                    if (jobMatch) {
                        const notifId = `notif_${profile.id}_${jobMatch.id}_${Date.now()}`;
                        await supabase.from('notifications').insert({
                            id: notifId,
                            user_id: profile.id,
                            job_id: jobMatch.id,
                            score: 95,
                            sent_at: new Date().toISOString()
                        });
                    }
                } catch (err) {
                    console.warn("Synchro notif Supabase échouée:", err);
                }
            }

            // Récupérer les détails de l'offre pour les envoyer de manière structurée
            let whatsappMessage = `Bonjour ! Voici le lien pour postuler à l'offre "${jobTitle}" : ${jobUrl}`;
            let emailBody = `Bonjour,\n\nVoici le lien pour postuler à l'offre de ${jobTitle} :\n\n${jobUrl}\n\nBonne chance !\nL'équipe carréemploie`;
            let jobMatch = null;

            try {
                const jobsList = await getActiveJobsList();
                jobMatch = jobsList.find(j => j.url === jobUrl);
                if (jobMatch) {
                    const cleanDescForWhatsapp = jobMatch.description.replace(/\*\*/g, '*');
                    
                    whatsappMessage = `*carréemploie - Détails de l'offre* 🌟\n\n` +
                        `*Poste :* ${jobMatch.title}\n` +
                        `*Entreprise :* ${jobMatch.company}\n` +
                        `*Lieu :* ${jobMatch.location}\n` +
                        `*Source d'origine :* ${jobMatch.source}\n\n` +
                        `*Détails & Conditions :*\n${cleanDescForWhatsapp}\n\n` +
                        `*👉 Lien de candidature direct / Contact :*\n${jobMatch.url}`;

                    emailBody = `Bonjour ${profile ? profile.fullname : ''},\n\n` +
                        `Voici les détails complets et les coordonnées de l'offre qui vous intéresse :\n\n` +
                        `-----------------------------------------\n` +
                        `POSTE : ${jobMatch.title}\n` +
                        `ENTREPRISE : ${jobMatch.company}\n` +
                        `LIEU D'AFFECTATION : ${jobMatch.location}\n` +
                        `SOURCE D'ORIGINE : ${jobMatch.source}\n` +
                        `-----------------------------------------\n\n` +
                        `DÉTAILS & CRITÈRES DE L'OFFRE :\n` +
                        `${jobMatch.description}\n\n` +
                        `-----------------------------------------\n` +
                        `👉 CANAL DE POSTULATION DIRECT :\n` +
                        `${jobMatch.url}\n\n` +
                        `Bonne chance dans votre recherche !\n` +
                        `L'équipe carréemploie`;
                }
            } catch (err) {
                console.warn("Erreur de récupération de l'offre pour formater les messages:", err);
            }

            // Simuler l'envoi du lien et rediriger vers WhatsApp/Email
            setTimeout(() => {
                btnDetailApply.disabled = false;
                btnDetailApply.innerHTML = originalText;
                
                let sentAny = false;

                function sendApiEmail() {
                    fetch('/api/send-email', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            email: profile.email,
                            fullname: profile.fullname,
                            jobTitle: jobMatch ? jobMatch.title : jobTitle,
                            company: jobMatch ? jobMatch.company : "Non spécifiée",
                            location: jobMatch ? jobMatch.location : "Non spécifiée",
                            source: jobMatch ? jobMatch.source : "Non spécifiée",
                            description: jobMatch ? jobMatch.description : "Veuillez consulter l'offre en ligne.",
                            url: jobMatch ? jobMatch.url : jobUrl
                        })
                    })
                    .then(response => {
                        if (response.ok) {
                            showToast("Détails de l'offre envoyés sur votre boîte e-mail !", "success");
                        } else {
                            console.warn("Vercel api return code error, trying Netlify fallback...");
                            tryNetlifyFallback();
                        }
                    })
                    .catch(err => {
                        console.warn("Network error calling Vercel api, trying Netlify fallback:", err);
                        tryNetlifyFallback();
                    });
                }

                function tryNetlifyFallback() {
                    fetch('/.netlify/functions/send-email', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            email: profile.email,
                            fullname: profile.fullname,
                            jobTitle: jobMatch ? jobMatch.title : jobTitle,
                            company: jobMatch ? jobMatch.company : "Non spécifiée",
                            location: jobMatch ? jobMatch.location : "Non spécifiée",
                            source: jobMatch ? jobMatch.source : "Non spécifiée",
                            description: jobMatch ? jobMatch.description : "Veuillez consulter l'offre en ligne.",
                            url: jobMatch ? jobMatch.url : jobUrl
                        })
                    })
                    .then(response => {
                        if (response.ok) {
                            showToast("Détails de l'offre envoyés sur votre boîte e-mail !", "success");
                        } else {
                            console.warn("Netlify function return code error, falling back to mailto.");
                            triggerMailtoFallback();
                        }
                    })
                    .catch(err => {
                        console.warn("Network error calling Netlify function, falling back to mailto:", err);
                        triggerMailtoFallback();
                    });
                }

                function triggerMailtoFallback() {
                    showToast(`Coordonnées prêtes dans votre messagerie !`, "success");
                    const mailtoUrl = `mailto:${encodeURIComponent(profile.email)}?subject=${encodeURIComponent("Détails de l'offre - " + jobTitle)}&body=${encodeURIComponent(emailBody)}`;
                    window.open(mailtoUrl, '_blank');
                }

                function sendWhatsApp() {
                    showToast(`Coordonnées envoyées sur votre WhatsApp !`, "success");
                    const whatsappUrl = `https://api.whatsapp.com/send?phone=${encodeURIComponent(profile.phone)}&text=${encodeURIComponent(whatsappMessage)}`;
                    window.open(whatsappUrl, '_blank');
                }

                // 1. Déclencher l'e-mail automatique si activé
                if (profile.notifyEmail && profile.email) {
                    sentAny = true;
                    sendApiEmail();
                }

                // 2. Déclencher l'envoi WhatsApp si activé
                if (profile.notifyWhatsapp && profile.phone) {
                    sentAny = true;
                    // Léger délai pour ne pas bloquer les ouvertures d'onglets simultanées sur certains navigateurs
                    setTimeout(() => {
                        sendWhatsApp();
                    }, 300);
                }

                // 3. Fallback mailto si aucun canal n'est configuré
                if (!sentAny) {
                    triggerMailtoFallback();
                }
            }, 1000);
        });
    }


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
                } else if (error) {
                    console.warn("Supabase fetch error:", error);
                } else {
                    // L'utilisateur n'existe plus dans Supabase (supprimé) -> Nettoyage local !
                    console.log("🧹 Profil introuvable dans Supabase (supprimé). Nettoyage local...");
                    profile = null;
                    subscriptionStatus = 'Gratuit';
                    daysRemaining = 0;
                    localStorage.removeItem('user_profile');
                    localStorage.removeItem('user_id');
                    localStorage.removeItem('sub_status');
                    localStorage.removeItem('sub_days');
                }
            } catch (err) {
                console.warn("Erreur de chargement Supabase initial:", err);
            }
        }
        
        updateGlobalUI();
        await initHomeJobsGrid();

        // Ouvrir automatiquement le détail d'une offre si demandé dans l'URL (?job=...)
        const urlParams = new URLSearchParams(window.location.search);
        const jobId = urlParams.get('job');
        if (jobId) {
            console.log(`🔗 Détection d'un lien d'offre directe dans l'URL pour l'ID: ${jobId}`);
            try {
                const jobs = await getActiveJobsList();
                const job = jobs.find(j => j.id === jobId);
                if (job) {
                    openJobDetailsModalByTitle(job.title);
                }
            } catch (err) {
                console.warn("Impossible d'ouvrir l'offre directe:", err);
            }
        }
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

    // Espace Recruteur : Soumission d'une offre d'emploi
    const employerForm = document.getElementById('employer-submit-form');
    if (employerForm) {
        employerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const privateEmail = document.getElementById('emp-contact-email').value.trim();
            const privatePhone = document.getElementById('emp-contact-phone').value.trim();
            const company = document.getElementById('emp-company').value.trim();
            const title = document.getElementById('emp-title').value.trim();
            const location = document.getElementById('emp-location').value.trim();
            const deadlineDate = document.getElementById('emp-deadline').value;
            const contactRaw = document.getElementById('emp-contact').value.trim();
            const description = document.getElementById('emp-description').value.trim();

            if (!supabase) {
                showToast("Service de soumission indisponible (Supabase déconnecté).", "error");
                return;
            }

            // Formater le contact de postulation (mailto:, wa.me, ou brut)
            let formattedUrl = contactRaw;
            if (contactRaw.includes('@') && !contactRaw.startsWith('mailto:')) {
                formattedUrl = `mailto:${contactRaw}`;
            } else if (/^\+?[0-9\s]{8,}$/.test(contactRaw.replace(/[\s\-\(\)]/g, ''))) {
                const cleanPhone = contactRaw.replace(/[^0-9]/g, '');
                formattedUrl = `https://wa.me/${cleanPhone}`;
            }

            // Annexer les contacts privés à la description pour consultation par l'admin
            const fullDescription = `${description}\n\n📢 **[CONTACTS RECRUTEUR PRIVÉS - ADMIN]**\n📧 Email: ${privateEmail}\n📞 Téléphone: ${privatePhone}`;

            // Générer un ID unique temporaire préfixé par pending_
            const pendingId = `pending_emp_${Date.now()}`;

            try {
                const { error } = await supabase.from('jobs').insert({
                    id: pendingId,
                    title: title,
                    company: company,
                    location: location,
                    description: fullDescription,
                    source: "employer_submission",
                    url: formattedUrl,
                    deadline_date: deadlineDate,
                    scraped_at: new Date().toISOString()
                });

                if (error) throw error;

                showToast("Votre offre a été soumise avec succès ! Elle apparaîtra après validation.");
                employerForm.reset();
                switchTab('tab-home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } catch (err) {
                console.error("Employer submit error:", err);
                showToast("Une erreur est survenue lors de la soumission de l'offre.", "error");
            }
        });
    }
});
