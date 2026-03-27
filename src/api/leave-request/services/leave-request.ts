/**
 * leave-request service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::leave-request.leave-request', ({ strapi }) => ({
  /**
   * Calculer le nombre de jours de congé restants pour un employé
   */
  async getRemainingDays(userId: number) {
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const yearEnd = new Date(new Date().getFullYear(), 11, 31);
    
    // Récupérer les congés approuvés de l'année
    const approvedLeaves = await strapi.db.query('api::leave-request.leave-request').findMany({
      where: {
        user: userId,
        statuts: 'APPROVED',
        start_date: {
          $gte: yearStart,
          $lte: yearEnd
        }
      }
    });
    
    // Total des jours utilisés
    const usedDays = approvedLeaves.reduce((sum, leave) => sum + (leave.duration_days || 0), 0);
    
    return {
      annual: { total: 25, used: usedDays, remaining: Math.max(0, 25 - usedDays) },
      sick: { total: 10, used: 0, remaining: 10 },
      personal: { total: 5, used: 0, remaining: 5 }
    };
  },
  
  /**
   * Vérifier si un employé peut prendre des congés
   */
  async canTakeLeave(userId: number, startDate: Date, endDate: Date, type: string) {
    const remaining = await this.getRemainingDays(userId);
    const requestedDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Vérifier le type de congé
    if (type === 'ANNUAL' && remaining.annual.remaining < requestedDays) {
      return { allowed: false, reason: 'Pas assez de jours de congés annuels restants' };
    }
    
    if (type === 'SICK' && remaining.sick.remaining < requestedDays) {
      return { allowed: false, reason: 'Pas assez de jours de congés maladie restants' };
    }
    
    if (type === 'PERSONAL' && remaining.personal.remaining < requestedDays) {
      return { allowed: false, reason: 'Pas assez de jours de congés personnels restants' };
    }
    
    // Vérifier les chevauchements avec d'autres congés
    const overlappingLeaves = await strapi.db.query('api::leave-request.leave-request').findMany({
      where: {
        user: userId,
        statuts: { $in: ['PENDING', 'APPROVED'] },
        start_date: { $lte: endDate },
        end_date: { $gte: startDate }
      }
    });
    
    if (overlappingLeaves.length > 0) {
      return { allowed: false, reason: 'Les dates chevauchent une autre demande de congé' };
    }
    
    return { allowed: true };
  }
}));