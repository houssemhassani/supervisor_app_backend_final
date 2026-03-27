/**
 * overtime-request controller
 */

import { factories } from '@strapi/strapi';
import { DateTime } from 'luxon';

export default factories.createCoreController('api::overtime-request.overtime-request', ({ strapi }) => ({
  /**
   * Récupérer les demandes d'heures supplémentaires selon le rôle
   * - Employee: voit seulement ses propres demandes
   * - Manager/Admin: voit toutes les demandes
   */
  async find(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Employee ne voit que ses propres demandes
    if (userRole === 'employee') {
      const { data, meta } = await super.find(ctx);
      
      // Filtrer manuellement
      const filteredData = data.filter((item: any) => item.user?.id === user.id);
      
      return { data: filteredData, meta };
    }
    
    // Manager et admin voient tout
    const { data, meta } = await super.find(ctx);
    return { data, meta };
  },
  
  /**
   * Créer une demande d'heures supplémentaires
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
    
    // Si c'est un employee, forcer l'utilisateur à lui-même
    if (userRole === 'employee') {
      requestData.user = user.id;
      requestData.statuts = 'PENDING';
    }
    
    // Validation des heures
    if (requestData.hours && (requestData.hours < 1 || requestData.hours > 24)) {
      return ctx.badRequest('Les heures supplémentaires doivent être entre 1 et 24');
    }
    
    ctx.request.body = { data: requestData };
    
    const response = await super.create(ctx);
    return response;
  },
  
  /**
   * Mettre à jour une demande d'heures supplémentaires
   * - Employee: peut modifier seulement ses demandes en attente
   * - Manager/Admin: peut modifier toutes les demandes
   */
  async update(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Récupérer la demande
    const overtimeRequest = await strapi.db.query('api::overtime-request.overtime-request').findOne({
      where: { id },
      populate: { user: true }
    });
    
    if (!overtimeRequest) {
      return ctx.notFound('Demande non trouvée');
    }
    
    // Vérifier les permissions
    if (userRole === 'employee') {
      if (overtimeRequest.user.id !== user.id) {
        return ctx.forbidden('Vous ne pouvez pas modifier cette demande');
      }
      if (overtimeRequest.statuts !== 'PENDING') {
        return ctx.badRequest('Seules les demandes en attente peuvent être modifiées');
      }
    }
    
    const response = await super.update(ctx);
    return response;
  },
  
  /**
   * Supprimer une demande d'heures supplémentaires
   * - Employee: peut supprimer seulement ses demandes en attente
   * - Manager/Admin: peut supprimer toutes les demandes
   */
  async delete(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Récupérer la demande
    const overtimeRequest = await strapi.db.query('api::overtime-request.overtime-request').findOne({
      where: { id },
      populate: { user: true }
    });
    
    if (!overtimeRequest) {
      return ctx.notFound('Demande non trouvée');
    }
    
    // Vérifier les permissions
    if (userRole === 'employee') {
      if (overtimeRequest.user.id !== user.id) {
        return ctx.forbidden('Vous ne pouvez pas supprimer cette demande');
      }
      if (overtimeRequest.statuts !== 'PENDING') {
        return ctx.badRequest('Seules les demandes en attente peuvent être supprimées');
      }
    }
    
    const response = await super.delete(ctx);
    return response;
  },
  
  /**
   * Approuver une demande d'heures supplémentaires (Manager/Admin uniquement)
   */
  async approve(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    const { comments } = ctx.request.body;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Seul manager ou admin peut approuver
    if (userRole !== 'manager' && userRole !== 'admin') {
      return ctx.forbidden('Vous n\'avez pas les droits pour approuver une demande');
    }
    
    const now = new Date();
    
    const response = await strapi.db.query('api::overtime-request.overtime-request').update({
      where: { id },
      data: {
        statuts: 'APPROVED',
        manager: user.id,
        manager_comments: comments || null,
        approval_date: now
      }
    });
    
    // Créer une notification pour l'employé
    if (response && response.user) {
      try {
        await strapi.db.query('api::notification.notification').create({
          data: {
            user: response.user,
            title: 'Demande d\'heures supplémentaires approuvée',
            message: `Votre demande d'heures supplémentaires (${response.hours}h) a été approuvée.`,
            type: 'INFO',
            is_read: false,
            publishedAt: now
          }
        });
      } catch (notifError) {
        console.warn('⚠️ Erreur création notification:', notifError);
      }
    }
    
    return ctx.send({
      success: true,
      message: 'Demande approuvée',
      data: response
    });
  },
  
  /**
   * Rejeter une demande d'heures supplémentaires (Manager/Admin uniquement)
   */
  async reject(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    const { comments } = ctx.request.body;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Seul manager ou admin peut rejeter
    if (userRole !== 'manager' && userRole !== 'admin') {
      return ctx.forbidden('Vous n\'avez pas les droits pour rejeter une demande');
    }
    
    const now = new Date();
    
    const response = await strapi.db.query('api::overtime-request.overtime-request').update({
      where: { id },
      data: {
        statuts: 'REJECTED',
        manager: user.id,
        manager_comments: comments || null,
        approval_date: now
      }
    });
    
    // Créer une notification pour l'employé
    if (response && response.user) {
      try {
        await strapi.db.query('api::notification.notification').create({
          data: {
            user: response.user,
            title: 'Demande d\'heures supplémentaires rejetée',
            message: comments 
              ? `Votre demande d'heures supplémentaires a été rejetée. Motif: ${comments}`
              : 'Votre demande d\'heures supplémentaires a été rejetée.',
            type: 'WARNING',
            is_read: false,
            publishedAt: now
          }
        });
      } catch (notifError) {
        console.warn('⚠️ Erreur création notification:', notifError);
      }
    }
    
    return ctx.send({
      success: true,
      message: 'Demande rejetée',
      data: response
    });
  },
  
  /**
   * Récupérer les demandes pour une période donnée
   */
  async getByPeriod(ctx) {
    const { user } = ctx.state;
    const { startDate, endDate } = ctx.query;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    let whereClause: any = {};
    
    // Vérifier et convertir les dates
    if (startDate && typeof startDate === 'string') {
      whereClause.date = {
        $gte: new Date(startDate),
        $lte: endDate && typeof endDate === 'string' ? new Date(endDate) : new Date(startDate)
      };
    }
    
    // Filtrer par utilisateur si employee
    if (userRole === 'employee') {
      whereClause.user = user.id;
    }
    
    const requests = await strapi.db.query('api::overtime-request.overtime-request').findMany({
      where: whereClause,
      populate: { user: true, manager: true, project: true },
      orderBy: { date: 'desc' }
    });
    
    return ctx.send({
      success: true,
      data: requests
    });
  },
  
  /**
   * Récupérer le total des heures supplémentaires approuvées pour le mois
   */
  async getMonthlyTotal(ctx) {
    const { user } = ctx.state;
    const { year, month } = ctx.query;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    // Convertir les paramètres
    const currentYear = year && typeof year === 'string' ? parseInt(year) : new Date().getFullYear();
    const currentMonth = month && typeof month === 'string' ? parseInt(month) : new Date().getMonth() + 1;
    
    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0);
    
    const requests = await strapi.db.query('api::overtime-request.overtime-request').findMany({
      where: {
        user: user.id,
        statuts: 'APPROVED',
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }
    });
    
    const totalHours = requests.reduce((sum: number, req: any) => sum + (req.hours || 0), 0);
    
    return ctx.send({
      success: true,
      data: {
        year: currentYear,
        month: currentMonth,
        totalHours,
        requestsCount: requests.length
      }
    });
  },
  
  /**
   * Récupérer les heures supplémentaires restantes pour le mois
   */
  async getRemainingHours(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const requests = await strapi.db.query('api::overtime-request.overtime-request').findMany({
      where: {
        user: user.id,
        statuts: 'APPROVED',
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }
    });
    
    const usedHours = requests.reduce((sum: number, req: any) => sum + (req.hours || 0), 0);
    const maxHours = 10; // Limite mensuelle
    const remaining = Math.max(0, maxHours - usedHours);
    
    return ctx.send({
      success: true,
      data: {
        maxHours,
        usedHours,
        remaining,
        canRequest: remaining > 0
      }
    });
  }
}));