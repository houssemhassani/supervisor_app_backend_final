/**
 * time-log service
 */

import { factories } from '@strapi/strapi';
import { DateTime } from 'luxon';

export default factories.createCoreService('api::time-log.time-log', ({ strapi }) => ({
  /**
   * Récupérer le temps total travaillé pour un utilisateur
   */
  async getTotalWorkTime(userId: number, startDate?: Date, endDate?: Date): Promise<number> {
    let whereClause: any = {
      user: userId,
      statuts: 'FINISHED'
    };
    
    if (startDate && endDate) {
      whereClause.start_time = {
        $gte: startDate,
        $lte: endDate
      };
    }
    
    const logs = await strapi.db.query('api::time-log.time-log').findMany({
      where: whereClause
    });
    
    const totalMinutes = logs.reduce((sum: number, log: any) => sum + (log.net_work_minutes || 0), 0);
    return totalMinutes / 60; // Convertir en heures
  },
  
  /**
   * Récupérer le temps travaillé aujourd'hui pour un utilisateur
   */
  async getTodayWorkTime(userId: number): Promise<number> {
    const today = DateTime.now().toISODate();
    const startDate = new Date(`${today}T00:00:00.000Z`);
    const endDate = new Date(`${today}T23:59:59.999Z`);
    
    return this.getTotalWorkTime(userId, startDate, endDate);
  },
  
  /**
   * Récupérer la session active d'un utilisateur
   */
  async getActiveSession(userId: number): Promise<any> {
    const activeSession = await strapi.db.query('api::time-log.time-log').findOne({
      where: {
        user: userId,
        statuts: { $in: ['ACTIVE', 'PAUSED'] }
      },
      populate: { breaks: true, project: true }
    });
    
    if (activeSession) {
      const duration = Math.floor((new Date().getTime() - new Date(activeSession.start_time).getTime()) / 60000);
      return {
        ...activeSession,
        currentDuration: duration
      };
    }
    
    return null;
  },
  
  /**
   * Vérifier si un utilisateur a une session active
   */
  async hasActiveSession(userId: number): Promise<boolean> {
    const activeSession = await strapi.db.query('api::time-log.time-log').findOne({
      where: {
        user: userId,
        statuts: { $in: ['ACTIVE', 'PAUSED'] }
      }
    });
    
    return !!activeSession;
  },
  
  /**
   * Récupérer les statistiques de temps par jour
   */
  async getDailyStats(userId: number, days: number = 7): Promise<any[]> {
    const stats = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);
      
      const hours = await this.getTotalWorkTime(userId, date, nextDate);
      
      stats.push({
        date: date.toISOString().split('T')[0],
        hours: parseFloat(hours.toFixed(2))
      });
    }
    
    return stats;
  },
  
  /**
   * Récupérer les statistiques de temps par projet
   */
  async getProjectStats(userId: number, startDate?: Date, endDate?: Date): Promise<any[]> {
    let whereClause: any = {
      user: userId,
      statuts: 'FINISHED'
    };
    
    if (startDate && endDate) {
      whereClause.start_time = {
        $gte: startDate,
        $lte: endDate
      };
    }
    
    const logs = await strapi.db.query('api::time-log.time-log').findMany({
      where: whereClause,
      populate: { project: true }
    });
    
    const projectStats: any = {};
    
    for (const log of logs) {
      const projectId = log.project?.id;
      const projectName = log.project?.name || 'Sans projet';
      const minutes = log.net_work_minutes || 0;
      
      if (!projectStats[projectId]) {
        projectStats[projectId] = {
          projectId,
          projectName,
          totalMinutes: 0,
          sessions: 0
        };
      }
      
      projectStats[projectId].totalMinutes += minutes;
      projectStats[projectId].sessions++;
    }
    
    return Object.values(projectStats).map((s: any) => ({
      ...s,
      hours: parseFloat((s.totalMinutes / 60).toFixed(2))
    }));
  },
  
  /**
   * Calculer le temps effectif (net) d'une session
   */
  calculateNetWorkTime(startTime: Date, endTime: Date, breaks: any[] = []): number {
    const totalMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
    const breakMinutes = breaks.reduce((sum: number, b: any) => sum + (b.duration_minutes || 0), 0);
    return Math.max(0, totalMinutes - breakMinutes);
  },
  
  /**
   * Récupérer les statistiques mensuelles
   */
  async getMonthlyStats(userId: number, year: number, month: number): Promise<any> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const totalHours = await this.getTotalWorkTime(userId, startDate, endDate);
    const dailyStats = await this.getDailyStatsForMonth(userId, year, month);
    
    return {
      year,
      month,
      totalHours: parseFloat(totalHours.toFixed(2)),
      dailyStats
    };
  },
  
  /**
   * Récupérer les statistiques quotidiennes pour un mois
   */
  async getDailyStatsForMonth(userId: number, year: number, month: number): Promise<any[]> {
    const stats = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const startDate = new Date(year, month - 1, day);
      const endDate = new Date(year, month - 1, day + 1);
      
      const hours = await this.getTotalWorkTime(userId, startDate, endDate);
      
      stats.push({
        day,
        hours: parseFloat(hours.toFixed(2))
      });
    }
    
    return stats;
  }
}));