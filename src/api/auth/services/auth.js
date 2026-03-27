// src/api/auth/services/auth.js

'use strict';

module.exports = {
  /**
   * Génère un code aléatoire
   */
  generateResetCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let code = '';
    for (let i = 0; i < 7; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },
  
  /**
   * Envoie un email de réinitialisation
   */
  async sendResetEmail(email, username, code) {
    return await strapi.plugins['email'].services.email.send({
      to: email,
      subject: '🔐 Code de réinitialisation - SupervisorApp',
      html: this.getEmailTemplate(username, code),
      text: `Bonjour ${username},\n\nVotre code de réinitialisation est: ${code}\n\nCe code expirera dans 15 minutes.\n\nSupervisorApp`,
    });
  },
  
  /**
   * Template HTML de l'email
   */
  getEmailTemplate(username, code) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Réinitialisation mot de passe</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 20px; overflow: hidden;">
            <div style="text-align: center; padding: 40px 30px 20px;">
              <h1 style="color: white; margin: 0;">Supervisor<span style="color: #00b4db;">App</span></h1>
              <p style="color: rgba(255,255,255,0.7);">Réinitialisation du mot de passe</p>
            </div>
            <div style="background: white; padding: 40px 30px; border-radius: 20px; margin: 20px;">
              <p>Bonjour <strong>${username}</strong>,</p>
              <p>Votre code de réinitialisation est :</p>
              <div style="text-align: center; margin: 30px 0;">
                <div style="background: #f8f9fa; border: 2px dashed #00b4db; border-radius: 15px; padding: 20px;">
                  <span style="font-size: 36px; font-weight: bold; letter-spacing: 5px; color: #00b4db;">${code}</span>
                </div>
              </div>
              <p>Ce code expirera dans 15 minutes.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
};