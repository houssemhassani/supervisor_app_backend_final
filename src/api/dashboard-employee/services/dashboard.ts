// src/api/dashboard/services/dashboard.ts
import { DateTime } from 'luxon';
import type { Core } from '@strapi/strapi';

interface LateCheckResult {
  isLate: boolean;
  minutes: number;
}

interface DailyReport {
  workHours: number;
  breakHours: number;
  isLate: boolean;
  lateMinutes: number;
  earlyCheckout: number;
}

interface LeaveBalance {
  annual: { total: number; used: number; remaining: number };
  sick: { total: number; used: number; remaining: number };
  personal: { total: number; used: number; remaining: number };
}

interface OvertimeMonth {
  total: number;
  pending: number;
  remaining: number;
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Vérifier si l'utilisateur peut faire un check-in
   */
  async canCheckIn(userId: number): Promise<boolean> {
    try {
      const today = DateTime.now().toISODate();
      
      const existingAttendance = await strapi.db.query('api::attendance.attendance').findOne({
        where: {
          users_permissions_user: userId,
          date: {
            $gte: new Date(`${today}T00:00:00.000Z`),
            $lte: new Date(`${today}T23:59:59.999Z`)
          }
        }
      });
      
      return !existingAttendance;
    } catch (error) {
      console.error('❌ Error in canCheckIn:', error);
      return true; // En cas d'erreur, on autorise le check-in
    }
  },
  
  /**
   * Vérifier si l'utilisateur peut faire un check-out
   */
  async canCheckOut(userId: number): Promise<boolean> {
    try {
      const today = DateTime.now().toISODate();
      
      const attendance = await strapi.db.query('api::attendance.attendance').findOne({
        where: {
          users_permissions_user: userId,
          date: {
            $gte: new Date(`${today}T00:00:00.000Z`),
            $lte: new Date(`${today}T23:59:59.999Z`)
          },
          check_out: null
        }
      });
      
      return !!attendance;
    } catch (error) {
      console.error('❌ Error in canCheckOut:', error);
      return false;
    }
  },
  
  /**
   * Calculer les heures de travail
   */
  calculateWorkHours(checkIn: Date, checkOut: Date, breaks: any[] = []): number {
    try {
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      
      // Vérifier que les dates sont valides
      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        console.warn('⚠️ Dates invalides pour le calcul des heures');
        return 0;
      }
      
      const workMs = checkOutDate.getTime() - checkInDate.getTime();
      const breakMs = breaks.reduce((total: number, b: any) => {
        const duration = b.duration_minutes || 0;
        return total + (duration * 60 * 1000);
      }, 0);
      
      const workHours = (workMs - breakMs) / (1000 * 60 * 60);
      return Math.max(0, parseFloat(workHours.toFixed(2)));
    } catch (error) {
      console.error('❌ Error in calculateWorkHours:', error);
      return 0;
    }
  },
  
  /**
   * Vérifier le retard
   */
  checkLate(checkInTime: Date, expectedHour: number = 9): LateCheckResult {
    try {
      const checkIn = new Date(checkInTime);
      const expectedTime = new Date(checkIn);
      expectedTime.setHours(expectedHour, 0, 0, 0);
      
      if (checkIn > expectedTime) {
        const lateMinutes = Math.floor((checkIn.getTime() - expectedTime.getTime()) / (1000 * 60));
        return { isLate: true, minutes: lateMinutes };
      }
      return { isLate: false, minutes: 0 };
    } catch (error) {
      console.error('❌ Error in checkLate:', error);
      return { isLate: false, minutes: 0 };
    }
  },
  
  /**
   * Générer le rapport quotidien
   */
  async generateDailyReport(userId: number, date: string): Promise<DailyReport | null> {
    try {
      const attendance = await strapi.db.query('api::attendance.attendance').findOne({
        where: {
          users_permissions_user: userId,
          date: {
            $gte: new Date(`${date}T00:00:00.000Z`),
            $lte: new Date(`${date}T23:59:59.999Z`)
          }
        }
      });
      
      if (!attendance || !attendance.check_out) {
        return null;
      }
      
      const breaks = await strapi.db.query('api::break.break').findMany({
        where: {
          users_permissions_user: userId,
          start_time: {
            $gte: new Date(`${date}T00:00:00.000Z`),
            $lte: new Date(`${date}T23:59:59.999Z`)
          },
          statuts: 'ENDED'
        }
      });
      
      const workHours = this.calculateWorkHours(attendance.check_in, attendance.check_out, breaks);
      const breakHours = breaks.reduce((total: number, b: any) => total + (b.duration_minutes || 0), 0) / 60;
      
      return {
        workHours: parseFloat(workHours.toFixed(2)),
        breakHours: parseFloat(breakHours.toFixed(2)),
        isLate: (attendance.check_in_late_minutes || 0) > 0,
        lateMinutes: attendance.check_in_late_minutes || 0,
        earlyCheckout: attendance.early_checkout_minutes || 0
      };
    } catch (error) {
      console.error('❌ Error in generateDailyReport:', error);
      return null;
    }
  },
  
  /**
   * Récupérer le solde des congés
   */
  async getLeaveBalance(userId: number): Promise<LeaveBalance> {
    try {
      const yearStart = new Date(new Date().getFullYear(), 0, 1);
      const yearEnd = new Date(new Date().getFullYear(), 11, 31);
      
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
      
      // Calculer les jours utilisés
      const usedDays = approvedLeaves.reduce((sum: number, leave: any) => {
        const duration = leave.duration_days || 0;
        return sum + duration;
      }, 0);
      
      return {
        annual: { 
          total: 25, 
          used: usedDays, 
          remaining: Math.max(0, 25 - usedDays) 
        },
        sick: { 
          total: 10, 
          used: 0, 
          remaining: 10 
        },
        personal: { 
          total: 5, 
          used: 0, 
          remaining: 5 
        }
      };
    } catch (error) {
      console.error('❌ Error in getLeaveBalance:', error);
      return {
        annual: { total: 25, used: 0, remaining: 25 },
        sick: { total: 10, used: 0, remaining: 10 },
        personal: { total: 5, used: 0, remaining: 5 }
      };
    }
  },
  
  /**
   * Récupérer les heures supplémentaires du mois
   */
  async getOvertimeMonth(userId: number): Promise<OvertimeMonth> {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);
      
      const approvedOvertime = await strapi.db.query('api::overtime-request.overtime-request').findMany({
        where: {
          user: userId,
          statuts: 'APPROVED',
          createdAt: {
            $gte: monthStart,
            $lte: monthEnd
          }
        }
      });
      
      const totalHours = approvedOvertime.reduce((sum: number, ot: any) => sum + (ot.hours || 0), 0);
      
      return {
        total: totalHours,
        pending: 0,
        remaining: Math.max(0, 10 - totalHours)
      };
    } catch (error) {
      console.error('❌ Error in getOvertimeMonth:', error);
      return {
        total: 0,
        pending: 0,
        remaining: 10
      };
    }
  },
  
  /**
   * Récupérer les statistiques hebdomadaires détaillées
   */
  async getWeeklyStatsDetailed(userId: number): Promise<any> {
    try {
      const startOfWeek = DateTime.now().startOf('week');
      const endOfWeek = DateTime.now().endOf('week');
      
      const attendances = await strapi.db.query('api::attendance.attendance').findMany({
        where: {
          users_permissions_user: userId,
          date: {
            $gte: startOfWeek.toJSDate(),
            $lte: endOfWeek.toJSDate()
          }
        }
      });
      
      const dailyStats: { [key: string]: any } = {
        monday: { workHours: 0, breakHours: 0, isLate: false, lateMinutes: 0 },
        tuesday: { workHours: 0, breakHours: 0, isLate: false, lateMinutes: 0 },
        wednesday: { workHours: 0, breakHours: 0, isLate: false, lateMinutes: 0 },
        thursday: { workHours: 0, breakHours: 0, isLate: false, lateMinutes: 0 },
        friday: { workHours: 0, breakHours: 0, isLate: false, lateMinutes: 0 },
        saturday: { workHours: 0, breakHours: 0, isLate: false, lateMinutes: 0 },
        sunday: { workHours: 0, breakHours: 0, isLate: false, lateMinutes: 0 }
      };
      
      let totalWorkHours = 0;
      let totalBreakHours = 0;
      let daysPresent = 0;
      let daysLate = 0;
      
      for (const attendance of attendances) {
        if (attendance.check_out) {
          const dayBreaks = await strapi.db.query('api::break.break').findMany({
            where: {
              users_permissions_user: userId,
              start_time: {
                $gte: new Date(attendance.date).setHours(0, 0, 0),
                $lte: new Date(attendance.date).setHours(23, 59, 59)
              },
              statuts: 'ENDED'
            }
          });
          
          const workHours = this.calculateWorkHours(attendance.check_in, attendance.check_out, dayBreaks);
          const breakHours = dayBreaks.reduce((sum: number, b: any) => sum + (b.duration_minutes || 0), 0) / 60;
          
          totalWorkHours += workHours;
          totalBreakHours += breakHours;
          daysPresent++;
          
          if (attendance.check_in_late_minutes > 0) daysLate++;
          
          // Remplir les données quotidiennes
          const dayOfWeek = new Date(attendance.date).getDay();
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const dayKey = dayNames[dayOfWeek];
          
          if (dailyStats[dayKey]) {
            dailyStats[dayKey] = {
              workHours: parseFloat(workHours.toFixed(2)),
              breakHours: parseFloat(breakHours.toFixed(2)),
              isLate: attendance.check_in_late_minutes > 0,
              lateMinutes: attendance.check_in_late_minutes || 0
            };
          }
        }
      }
      
      return {
        week: {
          start: startOfWeek.toISODate(),
          end: endOfWeek.toISODate()
        },
        totalWorkHours: parseFloat(totalWorkHours.toFixed(2)),
        totalBreakHours: parseFloat(totalBreakHours.toFixed(2)),
        daysPresent,
        daysLate,
        averageDailyHours: daysPresent > 0 ? parseFloat((totalWorkHours / daysPresent).toFixed(2)) : 0,
        expectedHours: 40,
        remainingHours: parseFloat((40 - totalWorkHours).toFixed(2)),
        daily: dailyStats
      };
    } catch (error) {
      console.error('❌ Error in getWeeklyStatsDetailed:', error);
      throw error;
    }
  },
  
  /**
   * Récupérer l'historique des présences
   */
  async getAttendanceHistory(userId: number, limit: number = 30): Promise<any[]> {
    try {
      const attendances = await strapi.db.query('api::attendance.attendance').findMany({
        where: {
          users_permissions_user: userId
        },
        orderBy: { date: 'desc' },
        limit
      });
      
      return attendances.map(attendance => ({
        id: attendance.id,
        date: attendance.date,
        checkIn: attendance.check_in,
        checkOut: attendance.check_out,
        status: attendance.statuts,
        workHours: attendance.work_hours,
        isLate: attendance.check_in_late_minutes > 0,
        lateMinutes: attendance.check_in_late_minutes
      }));
    } catch (error) {
      console.error('❌ Error in getAttendanceHistory:', error);
      return [];
    }
  },
  
  /**
   * Vérifier si une pause est en cours
   */
  async isOnBreak(userId: number): Promise<boolean> {
    try {
      const activeBreak = await strapi.db.query('api::break.break').findOne({
        where: {
          users_permissions_user: userId,
          statuts: 'ACTIVE'
        }
      });
      
      return !!activeBreak;
    } catch (error) {
      console.error('❌ Error in isOnBreak:', error);
      return false;
    }
  },
  
  /**
   * Récupérer la pause active
   */
  async getActiveBreak(userId: number): Promise<any | null> {
    try {
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
    } catch (error) {
      console.error('❌ Error in getActiveBreak:', error);
      return null;
    }
  },
  
  /**
   * Récupérer le temps total travaillé aujourd'hui
   */
  async getTodayWorkTime(userId: number): Promise<number> {
    try {
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
      
      if (!attendance) return 0;
      
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
      
      const endTime = attendance.check_out || new Date();
      const workHours = this.calculateWorkHours(attendance.check_in, endTime, breaks);
      
      return parseFloat(workHours.toFixed(2));
    } catch (error) {
      console.error('❌ Error in getTodayWorkTime:', error);
      return 0;
    }
  }
});