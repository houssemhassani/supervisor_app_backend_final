/**
 * break service
 */

import { factories } from '@strapi/strapi';
import { DateTime } from 'luxon';

export default factories.createCoreService('api::break.break', ({ strapi }) => ({
  /**
   * Vérifier si une pause est active pour un utilisateur
   */
  async hasActiveBreak(userId: number): Promise<boolean> {
    const activeBreak = await strapi.db.query('api::break.break').findOne({
      where: {
        users_permissions_user: userId,
        statuts: 'ACTIVE'
      }
    });
    
    return !!activeBreak;
  },
  
  /**
   * Récupérer la pause active pour un utilisateur
   */
  async getActiveBreak(userId: number): Promise<any> {
    const activeBreak = await strapi.db.query('api::break.break').findOne({
      where: {
        users_permissions_user: userId,
        statuts: 'ACTIVE'
      }
    });
    
    if (activeBreak) {
      const duration = Math.floor((new Date().getTime() - new Date(activeBreak.start_time).getTime()) / 60000);
      return {
        ...activeBreak,
        duration
      };
    }
    
    return null;
  },
  
  /**
   * Calculer le temps total de pause pour une période
   */
  async getTotalBreakTime(userId: number, startDate: Date, endDate: Date): Promise<number> {
    const breaks = await strapi.db.query('api::break.break').findMany({
      where: {
        users_permissions_user: userId,
        start_time: {
          $gte: startDate,
          $lte: endDate
        },
        statuts: 'ENDED'
      }
    });
    
    const totalMinutes = breaks.reduce((sum: number, b: any) => sum + (b.duration_minutes || 0), 0);
    return totalMinutes / 60; // Convertir en heures
  },
  
  /**
   * Calculer le temps de pause pour aujourd'hui
   */
  async getTodayBreakTime(userId: number): Promise<number> {
    const today = DateTime.now().toISODate();
    
    const breaks = await strapi.db.query('api::break.break').findMany({
      where: {
        users_permissions_user: userId,
        start_time: {
          $gte: new Date(`${today}T00:00:00.000Z`),
          $lte: new Date(`${today}T23:59:59.999Z`)
        },
        statuts: 'ENDED'
      }
    });
    
    const totalMinutes = breaks.reduce((sum: number, b: any) => sum + (b.duration_minutes || 0), 0);
    return totalMinutes / 60; // Convertir en heures
  },
  
  /**
   * Récupérer les pauses d'un utilisateur pour une période
   */
  async getUserBreaks(userId: number, startDate: Date, endDate: Date): Promise<any[]> {
    const breaks = await strapi.db.query('api::break.break').findMany({
      where: {
        users_permissions_user: userId,
        start_time: {
          $gte: startDate,
          $lte: endDate
        }
      },
      orderBy: { start_time: 'desc' }
    });
    
    return breaks;
  },
  
  /**
   * Récupérer les statistiques des pauses pour un utilisateur
   */
  async getBreakStats(userId: number, year: number, month: number): Promise<any> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const breaks = await strapi.db.query('api::break.break').findMany({
      where: {
        users_permissions_user: userId,
        start_time: {
          $gte: startDate,
          $lte: endDate
        },
        statuts: 'ENDED'
      }
    });
    
    const totalMinutes = breaks.reduce((sum: number, b: any) => sum + (b.duration_minutes || 0), 0);
    const totalHours = totalMinutes / 60;
    
    const breaksByType = {
      LUNCH: 0,
      COFFEE: 0,
      SHORT: 0,
      OTHER: 0
    };
    
    for (const b of breaks) {
      const type = b.type || 'SHORT';
      if (breaksByType[type] !== undefined) {
        breaksByType[type] += b.duration_minutes || 0;
      }
    }
    
    // Convertir en heures
    for (const type in breaksByType) {
      breaksByType[type] = breaksByType[type] / 60;
    }
    
    return {
      totalHours: parseFloat(totalHours.toFixed(2)),
      totalBreaks: breaks.length,
      breaksByType,
      averageDuration: breaks.length > 0 ? parseFloat((totalMinutes / breaks.length).toFixed(2)) : 0
    };
  }
}));