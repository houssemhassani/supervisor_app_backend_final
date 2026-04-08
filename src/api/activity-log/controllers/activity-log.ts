// src/api/activity-log/controllers/activity-log.ts

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::activity-log.activity-log', ({ strapi }) => ({
  
  // 🔥 Créer un log d'activité
  async create(ctx) {
    try {
      const { user } = ctx.state;
      
      if (!user) {
        return ctx.unauthorized('Non authentifié');
      }
      
      const { keyboard_clicks, mouse_clicks, activity_level, project, recorded_at } = ctx.request.body.data;
      
      const activityLog = await strapi.entityService.create('api::activity-log.activity-log', {
        data: {
          user: user.id,
          keyboard_clicks: keyboard_clicks || 0,
          mouse_clicks: mouse_clicks || 0,
          activity_level: activity_level || 50,
          recorded_at: recorded_at || new Date().toISOString(),
          publishedAt: new Date().toISOString(),
          ...(project && { project })
        }
      });
      
      return ctx.send({ 
        success: true, 
        data: activityLog 
      });
    } catch (error) {
      console.error('Erreur création activity log:', error);
      return ctx.internalServerError('Erreur lors de la création du log');
    }
  },
  
  // 🔥 Récupérer les logs d'activité de l'utilisateur connecté
  async find(ctx) {
    try {
      const { user } = ctx.state;
      
      if (!user) {
        return ctx.unauthorized('Non authentifié');
      }
      
      // Construction simple des filtres
      const filters: any = {
        user: { id: { $eq: user.id } }
      };
      
      // Ajouter les filtres de la requête si existants
      if (ctx.query.filters) {
        Object.assign(filters, ctx.query.filters);
      }
      
      const entities = await strapi.entityService.findMany('api::activity-log.activity-log', {
        filters: filters,
        sort: ctx.query.sort,
        populate: { user: true, project: true }
      });
      
      return ctx.send({
        data: entities,
        meta: {
          pagination: {
            page: 1,
            pageSize: entities.length,
            pageCount: 1,
            total: entities.length
          }
        }
      });
    } catch (error) {
      console.error('Erreur find activity logs:', error);
      return ctx.internalServerError('Erreur lors de la récupération');
    }
  },
  
  // 🔥 Récupérer les statistiques d'activité du jour
  async getTodayStats(ctx) {
    try {
      const { user } = ctx.state;
      
      if (!user) {
        return ctx.unauthorized('Non authentifié');
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const logs = await strapi.entityService.findMany('api::activity-log.activity-log', {
        filters: {
          user: { id: { $eq: user.id } },
          recorded_at: { $gte: today.toISOString(), $lt: tomorrow.toISOString() }
        },
        sort: { recorded_at: 'asc' }
      });
      
      // Calculer les stats
      let totalKeyboardClicks = 0;
      let totalMouseClicks = 0;
      let avgActivityLevel = 0;
      
      logs.forEach((log: any) => {
        totalKeyboardClicks += log.keyboard_clicks || 0;
        totalMouseClicks += log.mouse_clicks || 0;
        avgActivityLevel += log.activity_level || 0;
      });
      
      avgActivityLevel = logs.length > 0 ? avgActivityLevel / logs.length : 0;
      
      return ctx.send({
        success: true,
        data: {
          total_keyboard_clicks: totalKeyboardClicks,
          total_mouse_clicks: totalMouseClicks,
          avg_activity_level: Math.round(avgActivityLevel),
          logs_count: logs.length,
          logs
        }
      });
    } catch (error) {
      console.error('Erreur stats activité:', error);
      return ctx.internalServerError('Erreur lors du calcul des stats');
    }
  }
}));