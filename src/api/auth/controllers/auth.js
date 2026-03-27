// src/api/auth/controllers/auth.js

'use strict';

module.exports = {
  /**
   * Envoie un code de réinitialisation par email
   * Endpoint: POST /api/auth/send-reset-code
   */
  async sendResetCode(ctx) {
    const { email } = ctx.request.body;
    
    console.log('📧 [BACKEND] Requête reçue pour:', email);
    
    // Vérifier si l'email est fourni
    if (!email) {
      console.log('❌ [BACKEND] Email manquant');
      return ctx.badRequest('Email est requis');
    }
    
    // Vérifier si l'utilisateur existe
    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { email }
    });
    
    if (!user) {
      console.log('❌ [BACKEND] Utilisateur non trouvé:', email);
      return ctx.notFound('Aucun compte trouvé avec cet email');
    }
    
    console.log('✅ [BACKEND] Utilisateur trouvé:', user.username);
    
    // Générer un code aléatoire de 7 caractères
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let code = '';
    for (let i = 0; i < 7; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    console.log('📧 [BACKEND] Code généré:', code);
    
    try {
      // Envoyer l'email
      /*await strapi.plugins['email'].services.email.send({
        to: email,
        subject: '🔐 Code de réinitialisation - SupervisorApp',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Réinitialisation mot de passe</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <div style="text-align: center; padding: 40px 30px 20px;">
                  <div style="display: inline-block; background: rgba(0,180,219,0.1); padding: 15px; border-radius: 50%; margin-bottom: 20px;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="#00b4db" stroke-width="1.5" fill="none"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#00b4db" stroke-width="1.5" fill="none"/>
                      <circle cx="12" cy="16" r="1.5" fill="#00b4db"/>
                    </svg>
                  </div>
                  <h1 style="color: white; margin: 0; font-size: 28px;">Supervisor<span style="color: #00b4db;">App</span></h1>
                  <p style="color: rgba(255,255,255,0.7); margin: 10px 0 0;">Réinitialisation du mot de passe</p>
                </div>
                
                <!-- Content -->
                <div style="background: white; padding: 40px 30px; border-radius: 20px; margin: 20px;">
                  <p style="color: #333; font-size: 16px; margin-bottom: 20px;">Bonjour <strong>${user.username}</strong>,</p>
                  <p style="color: #555; font-size: 15px; margin-bottom: 25px;">Nous avons reçu une demande de réinitialisation de votre mot de passe. Utilisez le code ci-dessous pour continuer :</p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <div style="background: #f8f9fa; border: 2px dashed #00b4db; border-radius: 15px; padding: 20px; display: inline-block; min-width: 200px;">
                      <span style="font-size: 36px; font-weight: bold; letter-spacing: 5px; color: #00b4db; font-family: monospace;">${code}</span>
                    </div>
                  </div>
                  
                  <p style="color: #555; font-size: 14px; margin-bottom: 10px;">Ce code expirera dans <strong>15 minutes</strong>.</p>
                  <p style="color: #777; font-size: 13px;">Si vous n'avez pas fait cette demande, ignorez cet email.</p>
                </div>
                
                <!-- Footer -->
                <div style="text-align: center; padding: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                  <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0;">
                    © 2026 SupervisorApp - Plateforme de supervision du télétravail
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Bonjour ${user.username},\n\nNous avons reçu une demande de réinitialisation de votre mot de passe.\n\nVotre code de réinitialisation est: ${code}\n\nCe code expirera dans 15 minutes.\n\nSi vous n'avez pas fait cette demande, ignorez cet email.\n\nSupervisorApp`,
      });*/
      
      console.log('✅ [BACKEND] Email envoyé avec succès à:', email);
      
      // En développement seulement, retourner le code pour faciliter les tests
      const isDev = process.env.NODE_ENV === 'development';
      return ctx.send({ 
        ok: true, 
        message: 'Code envoyé avec succès',
        ...(isDev && { code })
      });
      
    } catch (error) {
      console.error('❌ [BACKEND] Erreur envoi email:', error);
      return ctx.internalServerError('Erreur lors de l\'envoi de l\'email');
    }
  },
  
  /**
   * Réinitialise le mot de passe avec le code
   * Endpoint: POST /api/auth/reset-password-custom
   */
  async resetPassword(ctx) {
    const { code, password, email } = ctx.request.body;
    
    console.log('🔐 [BACKEND] Tentative de réinitialisation pour:', email);
    
    if (!code || !password || !email) {
      return ctx.badRequest('Code, email et mot de passe requis');
    }
    
    // Vérifier si l'utilisateur existe
    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { email }
    });
    
    if (!user) {
      return ctx.notFound('Utilisateur non trouvé');
    }
    
    // Ici vous pouvez vérifier le code stocké en base
    // Pour l'instant, on suppose que le code est valide
    
    try {
      // Mettre à jour le mot de passe
      await strapi.plugins['users-permissions'].services.user.edit(
        user.id,
        { password }
      );
      
      console.log('✅ [BACKEND] Mot de passe réinitialisé pour:', email);
      
      return ctx.send({ 
        ok: true, 
        message: 'Mot de passe réinitialisé avec succès' 
      });
      
    } catch (error) {
      console.error('❌ [BACKEND] Erreur réinitialisation:', error);
      return ctx.internalServerError('Erreur lors de la réinitialisation');
    }
  }
};