/**
 * holiday service
 */

import { factories } from '@strapi/strapi';
import { DateTime } from 'luxon';

export default factories.createCoreService('api::holiday.holiday', ({ strapi }) => ({
  /**
   * Vérifier si une date est un jour férié pour un utilisateur
   */
  async isHolidayForUser(userId: number, date: Date): Promise<boolean> {
    const holidays = await strapi.db.query('api::holiday.holiday').findMany({
      where: {
        date: {
          $gte: new Date(date.setHours(0, 0, 0, 0)),
          $lte: new Date(date.setHours(23, 59, 59, 999))
        }
      },
      populate: { applicable_to: true }
    });
    
    for (const holiday of holidays) {
      // Si aucun utilisateur spécifié, applicable à tous
      if (!holiday.applicable_to || holiday.applicable_to.length === 0) {
        return true;
      }
      // Vérifier si l'utilisateur est dans la liste
      if (holiday.applicable_to.some((u: any) => u.id === userId)) {
        return true;
      }
    }
    
    return false;
  },
  
  /**
   * Récupérer tous les jours fériés pour une année
   */
  async getHolidaysByYear(year: number): Promise<any[]> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    
    const holidays = await strapi.db.query('api::holiday.holiday').findMany({
      where: {
        date: {
          $gte: startDate,
          $lte: endDate
        }
      },
      orderBy: { date: 'asc' }
    });
    
    return holidays;
  },
  
  /**
   * Récupérer les jours fériés pour un utilisateur
   */
  async getUserHolidays(userId: number, year?: number): Promise<any[]> {
    const currentYear = year || new Date().getFullYear();
    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear, 11, 31);
    
    let holidays = await strapi.db.query('api::holiday.holiday').findMany({
      where: {
        date: {
          $gte: startDate,
          $lte: endDate
        }
      },
      populate: { applicable_to: true },
      orderBy: { date: 'asc' }
    });
    
    // Filtrer pour l'utilisateur
    holidays = holidays.filter((holiday: any) => {
      if (!holiday.applicable_to || holiday.applicable_to.length === 0) {
        return true;
      }
      return holiday.applicable_to.some((u: any) => u.id === userId);
    });
    
    return holidays;
  },
  
  /**
   * Récupérer le prochain jour férié pour un utilisateur
   */
  async getNextHolidayForUser(userId: number): Promise<any> {
    const today = new Date();
    const endOfYear = new Date(today.getFullYear(), 11, 31);
    
    let holidays = await strapi.db.query('api::holiday.holiday').findMany({
      where: {
        date: {
          $gte: today,
          $lte: endOfYear
        }
      },
      orderBy: { date: 'asc' },
      limit: 10,
      populate: { applicable_to: true }
    });
    
    holidays = holidays.filter((holiday: any) => {
      if (!holiday.applicable_to || holiday.applicable_to.length === 0) {
        return true;
      }
      return holiday.applicable_to.some((u: any) => u.id === userId);
    });
    
    return holidays[0] || null;
  },
  
  /**
   * Compter les jours fériés dans une période
   */
  async countHolidaysInPeriod(userId: number, startDate: Date, endDate: Date): Promise<number> {
    let holidays = await strapi.db.query('api::holiday.holiday').findMany({
      where: {
        date: {
          $gte: startDate,
          $lte: endDate
        }
      },
      populate: { applicable_to: true }
    });
    
    holidays = holidays.filter((holiday: any) => {
      if (!holiday.applicable_to || holiday.applicable_to.length === 0) {
        return true;
      }
      return holiday.applicable_to.some((u: any) => u.id === userId);
    });
    
    return holidays.length;
  },
  
  /**
   * Créer un jour férié récurrent
   */
  async createRecurringHoliday(data: any): Promise<any> {
    const { name, date, type, is_recurring, applicable_to } = data;
    
    const holiday = await strapi.db.query('api::holiday.holiday').create({
      data: {
        name,
        date: new Date(date),
        type,
        is_recurring: is_recurring || false,
        applicable_to: applicable_to || [],
        publishedAt: new Date()
      }
    });
    
    return holiday;
  },
  
  /**
   * Générer les jours fériés récurrents pour une année
   */
  async generateRecurringHolidays(year: number): Promise<void> {
    const recurringHolidays = await strapi.db.query('api::holiday.holiday').findMany({
      where: {
        is_recurring: true
      }
    });
    
    for (const holiday of recurringHolidays) {
      const originalDate = new Date(holiday.date);
      const newDate = new Date(year, originalDate.getMonth(), originalDate.getDate());
      
      // Vérifier si déjà existant
      const existing = await strapi.db.query('api::holiday.holiday').findOne({
        where: {
          name: holiday.name,
          date: {
            $gte: new Date(year, 0, 1),
            $lte: new Date(year, 11, 31)
          }
        }
      });
      
      if (!existing) {
        await strapi.db.query('api::holiday.holiday').create({
          data: {
            name: holiday.name,
            date: newDate,
            type: holiday.type,
            is_recurring: false,
            applicable_to: holiday.applicable_to,
            publishedAt: new Date()
          }
        });
      }
    }
  }
}));