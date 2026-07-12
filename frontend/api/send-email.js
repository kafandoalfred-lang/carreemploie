const https = require('https');

module.exports = async (req, res) => {
  // CORS Headers pour permettre les requêtes depuis n'importe quelle origine si besoin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Autoriser uniquement les requêtes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { email, jobTitle, company, location, source, description, url, fullname } = req.body;

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    if (!RESEND_API_KEY) {
      return res.status(500).json({ error: 'Resend API Key is not configured on Vercel environment variables.' });
    }

    // Convertir le markdown simple de la description en HTML pour l'e-mail
    const formattedDescription = description
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    const payload = JSON.stringify({
      from: `carréemploie <${RESEND_FROM_EMAIL}>`,
      to: [email],
      subject: `[carréemploie] Détails de l'offre : ${jobTitle} - ${company}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; line-height: 1.6; margin: 0 auto; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 8px; margin-top: 0;">carréemploie - Détails de l'offre 🌟</h2>
          <p>Bonjour <strong>${fullname || ''}</strong>,</p>
          <p>Voici les détails complets de l'offre d'emploi qui a retenu votre attention :</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
            <h3 style="margin-top: 0; color: #0f172a; font-size: 1.15rem;">${jobTitle}</h3>
            <p style="margin: 6px 0;"><strong>Entreprise :</strong> ${company}</p>
            <p style="margin: 6px 0;"><strong>Lieu :</strong> ${location}</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 12px 0;">
            <p style="margin: 6px 0; line-height: 1.5;"><strong>Détails & Critères :</strong><br><br>${formattedDescription}</p>
          </div>

          <div style="margin-top: 25px; text-align: center;">
            <a href="${url}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.15);">Postuler à l'offre d'emploi</a>
          </div>

          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 0;">Cet e-mail a été généré automatiquement par carréemploie.</p>
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

    const resendResponse = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            body: body
          });
        });
      });

      req.on('error', (e) => reject(e));
      req.write(payload);
      req.end();
    });

    if (resendResponse.statusCode >= 200 && resendResponse.statusCode < 300) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(resendResponse.statusCode).send(resendResponse.body);
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
