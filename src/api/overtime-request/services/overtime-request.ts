/**
 * overtime-request service
 */

import { factories } from '@strapi/strapi';
import { DateTime } from 'luxon';

export default factories.createCoreService('api::overtime-request.overtime-request', ({ strapi }) => ({
  /**
   * Calculer le total des heures supplémentaires approuvées pour un mois
   */
  async getMonthlyTotal(userId: number, year: number, month: number): Promise<number> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const requests = await strapi.db.query('api::overtime-request.overtime-request').findMany({
      where: {
        user: userId,
        statuts: 'APPROVED',
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }
    });
    
    return requests.reduce((sum: number, req: any) => sum + (req.hours || 0), 0);
  },
  
  /**
   * Vérifier si un utilisateur peut demander des heures supplémentaires
   */
  async canRequestOvertime(userId: number, hours: number, date: Date): Promise<{ allowed: boolean; reason?: string }> {
    const maxHoursPerDay = 4;
    const maxHoursPerMonth = 10;
    
    // Vérifier les heures par jour
    if (hours > maxHoursPerDay) {
      return { allowed: false, reason: `Maximum ${maxHoursPerDay} heures par jour` };
    }
    
    // Vérifier les heures du mois
    const currentYear = date.getFullYear();
    const currentMonth = date.getMonth() + 1;
    const monthlyTotal = await this.getMonthlyTotal(userId, currentYear, currentMonth);
    
    if (monthlyTotal + hours > maxHoursPerMonth) {
      const remaining = maxHoursPerMonth - monthlyTotal;
      return { allowed: false, reason: `Vous avez déjà ${monthlyTotal}h ce mois-ci. Il vous reste ${remaining}h disponibles` };
    }
    
    // Vérifier les doublons pour le même jour
    const existingRequest = await strapi.db.query('api::overtime-request.overtime-request').findOne({
      where: {
        user: userId,
        date: {
          $gte: new Date(date.setHours(0, 0, 0, 0)),
          $lte: new Date(date.setHours(23, 59, 59, 999))
        },
        statuts: { $in: ['PENDING', 'APPROVED'] }
      }
    });
    
    if (existingRequest) {
      return { allowed: false, reason: 'Vous avez déjà une demande pour cette date' };
    }
    
    return { allowed: true };
  },
  
  /**
   * Récupérer les demandes en attente pour un manager
   */
  async getPendingRequestsForManager(managerId: number): Promise<any[]> {
    const requests = await strapi.db.query('api::overtime-request.overtime-request').findMany({
      where: {
        statuts: 'PENDING'
      },
      populate: { user: true, project: true },
      orderBy: { date: 'asc' }
    });
    
    // Filtrer les demandes des employés sous ce manager
    // (à adapter selon votre structure d'équipe)
    return requests;
  },
  
  /**
   * Récupérer les statistiques des heures supplémentaires
   */
  async getOvertimeStats(userId: number, year: number): Promise<any> {
    const stats = [];
    
    for (let month = 1; month <= 12; month++) {
      const total = await this.getMonthlyTotal(userId, year, month);
      stats.push({
        month,
        total,
        formatted: `${total}h`
      });
    }
    
    const yearTotal = stats.reduce((sum, s) => sum + s.total, 0);
    
    return {
      year,
      monthly: stats,
      yearTotal,
      averagePerMonth: parseFloat((yearTotal / 12).toFixed(2))
    };
  },
  
  /**
   * Vérifier les heures supplémentaires en cours
   */
  async getPendingOvertime(userId: number): Promise<any[]> {
    const requests = await strapi.db.query('api::overtime-request.overtime-request').findMany({
      where: {
        user: userId,
        statuts: 'PENDING'
      },
      orderBy: { date: 'asc' }
    });
    
    return requests;
  },
  
  /**
   * Vérifier si une date est valide pour les heures supplémentaires
   */
  async isValidOvertimeDate(date: Date, userId: number): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Ne peut pas demander pour une date passée
    if (date < today) {
      return false;
    }
    
    // Vérifier si c'est un week-end
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Les heures supplémentaires sont généralement autorisées en semaine après le travail
    // ou le week-end
    return true;
  },
  
  /**
   * Compter les heures supplémentaires approuvées
   */
  async countApprovedOvertime(userId: number, startDate: Date, endDate: Date): Promise<number> {
    const requests = await strapi.db.query('api::overtime-request.overtime-request').findMany({
      where: {
        user: userId,
        statuts: 'APPROVED',
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }
    });
    
    return requests.reduce((sum: number, req: any) => sum + (req.hours || 0), 0);
  }
}));