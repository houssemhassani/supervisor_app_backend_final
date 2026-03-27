/**
 * break controller
 */

import { factories } from '@strapi/strapi';
import { DateTime } from 'luxon';

export default factories.createCoreController('api::break.break', ({ strapi }) => ({
  /**
   * Récupérer les pauses selon le rôle
   * - Employee: voit seulement ses propres pauses
   * - Manager/Admin: voit toutes les pauses
   */
  async find(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Employee ne voit que ses propres pauses
    if (userRole === 'employee') {
      const { data, meta } = await super.find(ctx);
      
      // Filtrer manuellement
      const filteredData = data.filter((item: any) => item.users_permissions_user?.id === user.id);
      
      return { data: filteredData, meta };
    }
    
    // Manager et admin voient tout
    const { data, meta } = await super.find(ctx);
    return { data, meta };
  },
  
  /**
   * Créer une pause
   * - Employee: peut créer pour lui-même via le dashboard
   * - Manager/Admin: peut créer pour n'importe qui
   */
  async create(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    const requestData = ctx.request.body?.data || {};
    
    // Employee ne peut créer que pour lui-même
    if (userRole === 'employee') {
      requestData.users_permissions_user = user.id;
      requestData.statuts = 'ACTIVE';
    }
    
    ctx.request.body = { data: requestData };
    
    const response = await super.create(ctx);
    return response;
  },
  
  /**
   * Mettre à jour une pause
   * - Employee: peut modifier seulement ses propres pauses actives
   * - Manager/Admin: peut modifier toutes les pauses
   */
  async update(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Récupérer la pause
    const breakRecord = await strapi.db.query('api::break.break').findOne({
      where: { id },
      populate: { users_permissions_user: true }
    });
    
    if (!breakRecord) {
      return ctx.notFound('Pause non trouvée');
    }
    
    // Vérifier les permissions
    if (userRole === 'employee') {
      if (breakRecord.users_permissions_user?.id !== user.id) {
        return ctx.forbidden('Vous ne pouvez pas modifier cette pause');
      }
      // Employee ne peut modifier que les pauses actives
      if (breakRecord.statuts !== 'ACTIVE') {
        return ctx.badRequest('Seules les pauses actives peuvent être modifiées');
      }
    }
    
    const response = await super.update(ctx);
    return response;
  },
  
  /**
   * Supprimer une pause
   * - Employee: ne peut pas supprimer
   * - Manager/Admin: peut supprimer toutes les pauses
   */
  async delete(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Employee ne peut pas supprimer
    if (userRole === 'employee') {
      return ctx.forbidden('Vous ne pouvez pas supprimer les pauses');
    }
    
    const response = await super.delete(ctx);
    return response;
  },
  
  /**
   * Démarrer une pause pour l'utilisateur connecté
   */
  async start(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const { type } = ctx.request.body;
    const now = new Date();
    
    // Vérifier si une pause est déjà active
    const activeBreak = await strapi.db.query('api::break.break').findOne({
      where: {
        users_permissions_user: user.id,
        statuts: 'ACTIVE'
      }
    });
    
    if (activeBreak) {
      return ctx.badRequest('Vous avez déjà une pause en cours');
    }
    
    // Récupérer le time log actif
    const activeTimeLog = await strapi.db.query('api::time-log.time-log').findOne({
      where: {
        user: user.id,
        statuts: 'ACTIVE'
      }
    });
    
    if (!activeTimeLog) {
      return ctx.badRequest('Aucune session de travail active');
    }
    
    // Créer la pause
    const breakRecord = await strapi.db.query('api::break.break').create({
      data: {
        users_permissions_user: user.id,
        time_log: activeTimeLog.id,
        start_time: now,
        type: type || 'SHORT',
        statuts: 'ACTIVE',
        publishedAt: now
      }
    });
    
    // Mettre à jour le time log en PAUSED
    await strapi.db.query('api::time-log.time-log').update({
      where: { id: activeTimeLog.id },
      data: { statuts: 'PAUSED' }
    });
    
    return ctx.send({
      success: true,
      message: 'Pause démarrée',
      data: breakRecord
    });
  },
  
  /**
   * Terminer une pause pour l'utilisateur connecté
   */
  async end(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const now = new Date();
    
    // Récupérer la pause active
    const activeBreak = await strapi.db.query('api::break.break').findOne({
      where: {
        users_permissions_user: user.id,
        statuts: 'ACTIVE'
      }
    });
    
    if (!activeBreak) {
      return ctx.badRequest('Aucune pause active');
    }
    
    // Calculer la durée
    const durationMinutes = Math.floor((now.getTime() - new Date(activeBreak.start_time).getTime()) / 60000);
    
    // Terminer la pause
    await strapi.db.query('api::break.break').update({
      where: { id: activeBreak.id },
      data: {
        end_time: now,
        duration_minutes: durationMinutes,
        statuts: 'ENDED'
      }
    });
    
    // Remettre le time log en ACTIVE
    if (activeBreak.time_log) {
      await strapi.db.query('api::time-log.time-log').update({
        where: { id: activeBreak.time_log.id },
        data: { statuts: 'ACTIVE' }
      });
    }
    
    return ctx.send({
      success: true,
      message: `Pause terminée après ${durationMinutes} minutes`,
      data: { durationMinutes }
    });
  },
  
  /**
   * Récupérer la pause active pour l'utilisateur connecté
   */
  async getActive(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const activeBreak = await strapi.db.query('api::break.break').findOne({
      where: {
        users_permissions_user: user.id,
        statuts: 'ACTIVE'
      }
    });
    
    if (activeBreak) {
      const duration = Math.floor((new Date().getTime() - new Date(activeBreak.start_time).getTime()) / 60000);
      return ctx.send({
        success: true,
        data: {
          ...activeBreak,
          duration
        }
      });
    }
    
    return ctx.send({
      success: true,
      data: null
    });
  },
  
  /**
   * Récupérer les pauses du jour pour l'utilisateur connecté
   */
  async getToday(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const today = DateTime.now().toISODate();
    
    const breaks = await strapi.db.query('api::break.break').findMany({
      where: {
        users_permissions_user: user.id,
        start_time: {
          $gte: new Date(`${today}T00:00:00.000Z`),
          $lte: new Date(`${today}T23:59:59.999Z`)
        }
      }
    });
    
    return ctx.send({
      success: true,
      data: breaks
    });
  }
}));