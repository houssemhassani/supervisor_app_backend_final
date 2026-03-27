/**
 * attendance service
 */

import { factories } from '@strapi/strapi';
import { DateTime } from 'luxon';

export default factories.createCoreService('api::attendance.attendance', ({ strapi }) => ({
  /**
   * Vérifier si un utilisateur a déjà pointé aujourd'hui
   */
  async hasCheckedInToday(userId: number): Promise<boolean> {
    const today = DateTime.now().toISODate();
    
    const attendance = await strapi.db.query('api::attendance.attendance').findOne({
      where: {
        users_permissions_user: userId,
        date: {
          $gte: new Date(`${today}T00:00:00.000Z`),
          $lte: new Date(`${today}T23:59:59.999Z`)
        }
      }
    });
    
    return !!attendance;
  },
  
  /**
   * Vérifier si un utilisateur a déjà pointé sa sortie aujourd'hui
   */
  async hasCheckedOutToday(userId: number): Promise<boolean> {
    const today = DateTime.now().toISODate();
    
    const attendance = await strapi.db.query('api::attendance.attendance').findOne({
      where: {
        users_permissions_user: userId,
        date: {
          $gte: new Date(`${today}T00:00:00.000Z`),
          $lte: new Date(`${today}T23:59:59.999Z`)
        },
        check_out: { $ne: null }
      }
    });
    
    return !!attendance;
  },
  
  /**
   * Récupérer la présence du jour pour un utilisateur
   */
  async getTodayAttendance(userId: number): Promise<any> {
    const today = DateTime.now().toISODate();
    
    const attendance = await strapi.db.query('api::attendance.attendance').findOne({
      where: {
        users_permissions_user: userId,
        date: {
          $gte: new Date(`${today}T00:00:00.000Z`),
          $lte: new Date(`${today}T23:59:59.999Z`)
        }
      }
    });
    
    return attendance;
  },
  
  /**
   * Calculer les heures travaillées pour une période
   */
  async calculateWorkHours(userId: number, startDate: Date, endDate: Date): Promise<number> {
    const attendances = await strapi.db.query('api::attendance.attendance').findMany({
      where: {
        users_permissions_user: userId,
        date: {
          $gte: startDate,
          $lte: endDate
        },
        check_out: { $ne: null }
      }
    });
    
    let totalHours = 0;
    
    for (const attendance of attendances) {
      const workHours = (new Date(attendance.check_out).getTime() - new Date(attendance.check_in).getTime()) / (1000 * 60 * 60);
      totalHours += workHours;
    }
    
    return parseFloat(totalHours.toFixed(2));
  },
  
  /**
   * Récupérer les statistiques mensuelles
   */
  async getMonthlyStats(userId: number, year: number, month: number): Promise<any> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const attendances = await strapi.db.query('api::attendance.attendance').findMany({
      where: {
        users_permissions_user: userId,
        date: {
          $gte: startDate,
          $lte: endDate
        },
        check_out: { $ne: null }
      }
    });
    
    let totalWorkHours = 0;
    let daysPresent = 0;
    let daysLate = 0;
    
    for (const attendance of attendances) {
      const workHours = (new Date(attendance.check_out).getTime() - new Date(attendance.check_in).getTime()) / (1000 * 60 * 60);
      totalWorkHours += workHours;
      daysPresent++;
      
      if (attendance.check_in_late_minutes > 0) {
        daysLate++;
      }
    }
    
    return {
      year,
      month,
      totalWorkHours: parseFloat(totalWorkHours.toFixed(2)),
      daysPresent,
      daysLate,
      averageDailyHours: daysPresent > 0 ? parseFloat((totalWorkHours / daysPresent).toFixed(2)) : 0
    };
  }
}));