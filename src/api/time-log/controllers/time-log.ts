/**
 * time-log controller
 */

import { factories } from '@strapi/strapi';
import { DateTime } from 'luxon';

export default factories.createCoreController('api::time-log.time-log', ({ strapi }) => ({
  /**
   * Récupérer les journaux de temps selon le rôle
   * - Employee: voit seulement ses propres journaux
   * - Manager: voit les journaux de son équipe + les siens
   * - Admin: voit tous les journaux
   */
  async find(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    if (userRole === 'employee') {
      // Employee: voir ses propres journaux
      const { data, meta } = await super.find(ctx);
      const filteredData = data.filter((log: any) => log.user?.id === user.id);
      return { data: filteredData, meta };
    }
    
    if (userRole === 'manager') {
      // Manager: voir les journaux de son équipe
      const { data, meta } = await super.find(ctx);
      
      // Récupérer les utilisateurs sous ce manager (à adapter selon votre structure)
      const teamUsers = await strapi.db.query('plugin::users-permissions.user').findMany({
        where: {
          manager: user.id // À adapter selon votre schéma
        }
      });
      
      const teamUserIds = teamUsers.map((u: any) => u.id);
      teamUserIds.push(user.id); // Inclure le manager lui-même
      
      const filteredData = data.filter((log: any) => teamUserIds.includes(log.user?.id));
      return { data: filteredData, meta };
    }
    
    // Admin voit tout
    const { data, meta } = await super.find(ctx);
    return { data, meta };
  },
  
  /**
   * Créer un journal de temps
   * - Employee: peut créer pour lui-même
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
      requestData.user = user.id;
      requestData.statuts = 'ACTIVE';
    }
    
    // Validation
    if (requestData.start_time && requestData.end_time) {
      const start = new Date(requestData.start_time);
      const end = new Date(requestData.end_time);
      if (start >= end) {
        return ctx.badRequest('La date de fin doit être postérieure à la date de début');
      }
      
      // Calculer le temps net (en minutes)
      const totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      const breakMinutes = requestData.total_break_minutes || 0;
      requestData.net_work_minutes = Math.max(0, totalMinutes - breakMinutes);
    }
    
    ctx.request.body = { data: requestData };
    
    const response = await super.create(ctx);
    return response;
  },
  
  /**
   * Mettre à jour un journal de temps
   * - Employee: peut modifier seulement ses propres journaux actifs
   * - Manager/Admin: peut modifier tous les journaux
   */
  async update(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    const requestData = ctx.request.body?.data || {};
    
    // Récupérer le journal
    const timeLog = await strapi.db.query('api::time-log.time-log').findOne({
      where: { id },
      populate: { user: true }
    });
    
    if (!timeLog) {
      return ctx.notFound('Journal non trouvé');
    }
    
    // Vérifier les permissions
    if (userRole === 'employee') {
      if (timeLog.user.id !== user.id) {
        return ctx.forbidden('Vous ne pouvez modifier que vos propres journaux');
      }
      if (timeLog.statuts !== 'ACTIVE') {
        return ctx.badRequest('Seuls les journaux actifs peuvent être modifiés');
      }
    }
    
    // Recalculer le temps net si nécessaire
    if (requestData.start_time || requestData.end_time || requestData.total_break_minutes !== undefined) {
      const start = requestData.start_time ? new Date(requestData.start_time) : new Date(timeLog.start_time);
      const end = requestData.end_time ? new Date(requestData.end_time) : (timeLog.end_time ? new Date(timeLog.end_time) : new Date());
      const breakMinutes = requestData.total_break_minutes !== undefined ? requestData.total_break_minutes : (timeLog.total_break_minutes || 0);
      
      if (start && end && start < end) {
        const totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
        requestData.net_work_minutes = Math.max(0, totalMinutes - breakMinutes);
      }
    }
    
    const response = await super.update(ctx);
    return response;
  },
  
  /**
   * Supprimer un journal de temps
   * - Employee: ne peut pas supprimer
   * - Manager/Admin: peut supprimer
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
      return ctx.forbidden('Les employés ne peuvent pas supprimer des journaux de temps');
    }
    
    const response = await super.delete(ctx);
    return response;
  },
  
  /**
   * Démarrer une session de temps
   */
  async startSession(ctx) {
    const { user } = ctx.state;
    const { projectId } = ctx.request.body;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    // Vérifier si une session active existe déjà
    const activeSession = await strapi.db.query('api::time-log.time-log').findOne({
      where: {
        user: user.id,
        statuts: { $in: ['ACTIVE', 'PAUSED'] }
      }
    });
    
    if (activeSession) {
      return ctx.badRequest('Vous avez déjà une session active');
    }
    
    const now = new Date();
    
    const timeLog = await strapi.db.query('api::time-log.time-log').create({
      data: {
        user: user.id,
        project: projectId || null,
        start_time: now,
        statuts: 'ACTIVE',
        total_break_minutes: 0,
        net_work_minutes: 0,
        publishedAt: now
      }
    });
    
    return ctx.send({
      success: true,
      message: 'Session démarrée',
      data: timeLog
    });
  },
  
  /**
   * Terminer une session de temps
   */
  async endSession(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const timeLog = await strapi.db.query('api::time-log.time-log').findOne({
      where: { id },
      populate: { user: true, breaks: true }
    });
    
    if (!timeLog) {
      return ctx.notFound('Session non trouvée');
    }
    
    if (timeLog.user.id !== user.id) {
      return ctx.forbidden('Vous ne pouvez terminer que vos propres sessions');
    }
    
    if (timeLog.statuts === 'FINISHED') {
      return ctx.badRequest('Cette session est déjà terminée');
    }
    
    const now = new Date();
    const totalMinutes = (now.getTime() - new Date(timeLog.start_time).getTime()) / (1000 * 60);
    
    // Calculer le temps total des pauses
    const breaks = timeLog.breaks || [];
    const totalBreakMinutes = breaks.reduce((sum: number, b: any) => sum + (b.duration_minutes || 0), 0);
    
    const updatedLog = await strapi.db.query('api::time-log.time-log').update({
      where: { id },
      data: {
        end_time: now,
        statuts: 'FINISHED',
        total_break_minutes: totalBreakMinutes,
        net_work_minutes: Math.max(0, totalMinutes - totalBreakMinutes)
      }
    });
    
    return ctx.send({
      success: true,
      message: 'Session terminée',
      data: updatedLog
    });
  },
  
  /**
   * Récupérer la session active de l'utilisateur
   */
  async getActiveSession(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const activeSession = await strapi.db.query('api::time-log.time-log').findOne({
      where: {
        user: user.id,
        statuts: { $in: ['ACTIVE', 'PAUSED'] }
      },
      populate: { breaks: true, project: true }
    });
    
    if (activeSession) {
      const duration = Math.floor((new Date().getTime() - new Date(activeSession.start_time).getTime()) / 60000);
      return ctx.send({
        success: true,
        data: {
          ...activeSession,
          currentDuration: duration
        }
      });
    }
    
    return ctx.send({
      success: true,
      data: null
    });
  },
  
  /**
   * Récupérer les statistiques de temps pour une période
   */
  async getStats(ctx) {
    const { user } = ctx.state;
    const { startDate, endDate } = ctx.query;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    let whereClause: any = {
      statuts: 'FINISHED'
    };
    
    // Vérifier et convertir les dates
    if (startDate && typeof startDate === 'string') {
      const startDateObj = new Date(startDate);
      const endDateObj = endDate && typeof endDate === 'string' ? new Date(endDate) : new Date();
      
      if (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
        whereClause.start_time = {
          $gte: startDateObj,
          $lte: endDateObj
        };
      }
    }
    
    if (userRole === 'employee') {
      whereClause.user = user.id;
    } else if (userRole === 'manager') {
      // Récupérer les utilisateurs sous ce manager
      const teamUsers = await strapi.db.query('plugin::users-permissions.user').findMany({
        where: { manager: user.id }
      });
      const teamUserIds = teamUsers.map((u: any) => u.id);
      teamUserIds.push(user.id);
      whereClause.user = { $in: teamUserIds };
    }
    
    const logs = await strapi.db.query('api::time-log.time-log').findMany({
      where: whereClause,
      populate: { user: true, project: true }
    });
    
    const totalMinutes = logs.reduce((sum: number, log: any) => sum + (log.net_work_minutes || 0), 0);
    const totalHours = totalMinutes / 60;
    
    const statsByUser: any = {};
    for (const log of logs) {
      const userId = log.user?.id;
      if (userId) {
        if (!statsByUser[userId]) {
          statsByUser[userId] = {
            userId,
            username: log.user?.username,
            totalMinutes: 0,
            sessions: 0
          };
        }
        statsByUser[userId].totalMinutes += log.net_work_minutes || 0;
        statsByUser[userId].sessions++;
      }
    }
    
    return ctx.send({
      success: true,
      data: {
        totalHours: parseFloat(totalHours.toFixed(2)),
        totalSessions: logs.length,
        byUser: Object.values(statsByUser).map((s: any) => ({
          ...s,
          hours: parseFloat((s.totalMinutes / 60).toFixed(2))
        }))
      }
    });
  }
}));