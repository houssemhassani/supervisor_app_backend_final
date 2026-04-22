/**
 * attendance controller
 */

import { factories } from '@strapi/strapi';
import { DateTime } from 'luxon';

// Fonction utilitaire pour calculer les statistiques
const calculateStats = (attendances) => {
  const stats = {
    totalDays: attendances.length,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    halfDays: 0,
    holidayDays: 0,
    totalWorkHours: 0
  };
  
  for (const attendance of attendances) {
    switch (attendance.statuts) {
      case 'PRESENT': 
        stats.presentDays++; 
        break;
      case 'ABSENT': 
        stats.absentDays++; 
        break;
      case 'LATE': 
        stats.lateDays++; 
        stats.presentDays++; 
        break;
      case 'HALF_DAY': 
        stats.halfDays++; 
        break;
      case 'HOLIDAY':
        stats.holidayDays++;
        break;
    }
    
    if (attendance.work_hours) {
      stats.totalWorkHours += parseFloat(attendance.work_hours);
    }
  }
  
  stats.totalWorkHours = parseFloat(stats.totalWorkHours.toFixed(2));
  
  return stats;
};

export default factories.createCoreController('api::attendance.attendance', ({ strapi }) => ({
  
  /**
   * Récupérer les présences selon le rôle
   */
  async find(ctx) {
    try {
      const { user } = ctx.state;
      
      // Si pas d'utilisateur authentifié, retourner toutes les présences
      if (!user) {
        const { data, meta } = await super.find(ctx);
        return { data, meta };
      }
      
      const userRole = user.role?.name?.toLowerCase();
      
      // Employee ne voit que ses propres présences
      if (userRole === 'employee') {
        const { data, meta } = await super.find(ctx);
        
        const filteredData = data.filter((item) => {
          const userId = item.users_permissions_user?.id || item.user?.id;
          return userId === user.id;
        });
        
        return { data: filteredData, meta };
      }
      
      // Manager et admin voient tout
      const { data, meta } = await super.find(ctx);
      return { data, meta };
      
    } catch (error) {
      console.error('Erreur dans find:', error);
      return ctx.badRequest('Erreur lors de la récupération des présences');
    }
  },
  
  /**
   * Créer une présence
   */
  async create(ctx) {
    try {
      const { user } = ctx.state;
      
      if (!user) {
        return ctx.unauthorized('Vous devez être connecté');
      }
      
      const userRole = user.role?.name?.toLowerCase();
      
      // Employee ne peut pas créer manuellement
      if (userRole === 'employee') {
        return ctx.forbidden('Les employés ne peuvent pas créer manuellement des présences');
      }
      
      const response = await super.create(ctx);
      return response;
      
    } catch (error) {
      console.error('Erreur dans create:', error);
      return ctx.badRequest('Erreur lors de la création de la présence');
    }
  },
  
  /**
   * Mettre à jour une présence
   */
  async update(ctx) {
    try {
      const { user } = ctx.state;
      
      if (!user) {
        return ctx.unauthorized('Vous devez être connecté');
      }
      
      const userRole = user.role?.name?.toLowerCase();
      
      // Employee ne peut pas modifier
      if (userRole === 'employee') {
        return ctx.forbidden('Vous ne pouvez pas modifier les présences');
      }
      
      const response = await super.update(ctx);
      return response;
      
    } catch (error) {
      console.error('Erreur dans update:', error);
      return ctx.badRequest('Erreur lors de la mise à jour de la présence');
    }
  },
  
  /**
   * Supprimer une présence
   */
  async delete(ctx) {
    try {
      const { user } = ctx.state;
      
      if (!user) {
        return ctx.unauthorized('Vous devez être connecté');
      }
      
      const userRole = user.role?.name?.toLowerCase();
      
      // Employee ne peut pas supprimer
      if (userRole === 'employee') {
        return ctx.forbidden('Vous ne pouvez pas supprimer les présences');
      }
      
      const response = await super.delete(ctx);
      return response;
      
    } catch (error) {
      console.error('Erreur dans delete:', error);
      return ctx.badRequest('Erreur lors de la suppression de la présence');
    }
  },
  
  /**
   * Récupérer la présence du jour pour l'utilisateur connecté
   */
  async getToday(ctx) {
    try {
      const { user } = ctx.state;
      
      if (!user) {
        return ctx.unauthorized('Vous devez être connecté');
      }
      
      const today = DateTime.now().toISODate();
      
      const attendance = await strapi.db.query('api::attendance.attendance').findOne({
        where: {
          users_permissions_user: user.id,
          date: {
            $gte: new Date(`${today}T00:00:00.000Z`),
            $lte: new Date(`${today}T23:59:59.999Z`)
          }
        }
      });
      
      return ctx.send({
        success: true,
        data: attendance || null
      });
      
    } catch (error) {
      console.error('Erreur dans getToday:', error);
      return ctx.badRequest('Erreur lors de la récupération de la présence du jour');
    }
  },
  
  /**
   * Récupérer les statistiques hebdomadaires pour l'utilisateur connecté
   */
  async getWeeklyStats(ctx) {
    try {
      const { user } = ctx.state;
      
      if (!user) {
        return ctx.unauthorized('Vous devez être connecté');
      }
      
      const startOfWeek = DateTime.now().startOf('week');
      const endOfWeek = DateTime.now().endOf('week');
      
      const attendances = await strapi.db.query('api::attendance.attendance').findMany({
        where: {
          users_permissions_user: user.id,
          date: {
            $gte: startOfWeek.toJSDate(),
            $lte: endOfWeek.toJSDate()
          }
        }
      });
      
      let totalWorkHours = 0;
      let daysPresent = 0;
      
      for (const attendance of attendances) {
        if (attendance.check_in && attendance.check_out) {
          const checkIn = new Date(attendance.check_in).getTime();
          const checkOut = new Date(attendance.check_out).getTime();
          const workHours = (checkOut - checkIn) / (1000 * 60 * 60);
          totalWorkHours += workHours;
          daysPresent++;
        } else if (attendance.check_in && !attendance.check_out) {
          daysPresent++;
        }
      }
      
      return ctx.send({
        success: true,
        data: {
          week: {
            start: startOfWeek.toISODate(),
            end: endOfWeek.toISODate()
          },
          totalWorkHours: parseFloat(totalWorkHours.toFixed(2)),
          daysPresent,
          averageDailyHours: daysPresent > 0 ? parseFloat((totalWorkHours / daysPresent).toFixed(2)) : 0
        }
      });
      
    } catch (error) {
      console.error('Erreur dans getWeeklyStats:', error);
      return ctx.badRequest('Erreur lors de la récupération des statistiques hebdomadaires');
    }
  },
  
  /**
   * Récupérer les statistiques mensuelles
   */
  async getMonthlyStats(ctx) {
    try {
      const { user } = ctx.state;
      const { userId, month, year } = ctx.request.query;
      
      if (!user) {
        return ctx.unauthorized('Vous devez être connecté');
      }
      
      const userRole = user.role?.name?.toLowerCase();
      let targetUserId = user.id;
      
      // Vérifier les droits pour voir les statistiques d'un autre utilisateur
      if ((userRole === 'manager' || userRole === 'admin') && userId) {
        targetUserId = typeof userId === 'string' ? parseInt(userId, 10) : Number(userId);
      }
      
      // ✅ CORRECTION: Conversion sécurisée des paramètres month et year
      let targetMonth = DateTime.now().month;
      let targetYear = DateTime.now().year;
      
      if (month) {
        const monthValue = typeof month === 'string' ? parseInt(month, 10) : Number(month);
        targetMonth = isNaN(monthValue) ? DateTime.now().month : monthValue;
      }
      
      if (year) {
        const yearValue = typeof year === 'string' ? parseInt(year, 10) : Number(year);
        targetYear = isNaN(yearValue) ? DateTime.now().year : yearValue;
      }
      
      const startOfMonth = DateTime.fromObject({ year: targetYear, month: targetMonth, day: 1 }).startOf('month');
      const endOfMonth = startOfMonth.endOf('month');
      
      const attendances = await strapi.db.query('api::attendance.attendance').findMany({
        where: {
          users_permissions_user: targetUserId,
          date: {
            $gte: startOfMonth.toJSDate(),
            $lte: endOfMonth.toJSDate()
          }
        }
      });
      
      const stats = calculateStats(attendances);
      
      // Récupérer les infos de l'utilisateur
      const targetUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: targetUserId }
      });
      
      return ctx.send({
        success: true,
        data: {
          user: targetUser ? {
            id: targetUser.id,
            username: targetUser.username,
            email: targetUser.email,
            firstname: targetUser.firstname,
            lastname: targetUser.lastname
          } : null,
          month: startOfMonth.toFormat('MMMM yyyy'),
          period: {
            start: startOfMonth.toISODate(),
            end: endOfMonth.toISODate()
          },
          totalWorkHours: stats.totalWorkHours,
          presentDays: stats.presentDays,
          absentDays: stats.absentDays,
          lateDays: stats.lateDays,
          halfDays: stats.halfDays,
          holidayDays: stats.holidayDays,
          totalDays: stats.totalDays,
          attendanceRate: stats.totalDays > 0 
            ? parseFloat(((stats.presentDays + stats.halfDays) / stats.totalDays * 100).toFixed(2))
            : 0
        }
      });
      
    } catch (error) {
      console.error('Erreur dans getMonthlyStats:', error);
      return ctx.badRequest('Erreur lors de la récupération des statistiques mensuelles');
    }
  },
  
  /**
   * Pointer arrivée (Check-in)
   */
  async checkIn(ctx) {
    try {
      const { user } = ctx.state;
      
      if (!user) {
        return ctx.unauthorized('Vous devez être connecté');
      }
      
      const now = new Date();
      const today = DateTime.now().toISODate();
      
      // Vérifier si déjà pointé aujourd'hui
      const existing = await strapi.db.query('api::attendance.attendance').findOne({
        where: {
          users_permissions_user: user.id,
          date: {
            $gte: new Date(`${today}T00:00:00.000Z`),
            $lte: new Date(`${today}T23:59:59.999Z`)
          }
        }
      });
      
      if (existing) {
        return ctx.badRequest('Vous avez déjà pointé aujourd\'hui');
      }
      
      // Vérifier le retard (9h)
      const expectedTime = new Date(now);
      expectedTime.setHours(9, 0, 0, 0);
      const isLate = now > expectedTime;
      const lateMinutes = isLate ? Math.floor((now.getTime() - expectedTime.getTime()) / 60000) : 0;
      
      // Créer la présence
      const attendance = await strapi.db.query('api::attendance.attendance').create({
        data: {
          users_permissions_user: user.id,
          date: now,
          check_in: now,
          ip_address: ctx.request.ip,
          check_in_late_minutes: lateMinutes,
          statuts: isLate ? 'LATE' : 'PRESENT',
          work_hours: 0,
          publishedAt: now
        }
      });
      
      return ctx.send({
        success: true,
        message: 'Check-in effectué avec succès',
        data: {
          attendance,
          isLate,
          lateMinutes
        }
      });
      
    } catch (error) {
      console.error('Erreur dans checkIn:', error);
      return ctx.badRequest('Erreur lors du check-in');
    }
  },
  
  /**
   * Pointer sortie (Check-out)
   */
  async checkOut(ctx) {
    try {
      const { user } = ctx.state;
      
      if (!user) {
        return ctx.unauthorized('Vous devez être connecté');
      }
      
      const today = DateTime.now().toISODate();
      
      const attendance = await strapi.db.query('api::attendance.attendance').findOne({
        where: {
          users_permissions_user: user.id,
          date: {
            $gte: new Date(`${today}T00:00:00.000Z`),
            $lte: new Date(`${today}T23:59:59.999Z`)
          },
          check_out: null
        }
      });
      
      if (!attendance) {
        return ctx.badRequest('Aucun check-in trouvé pour aujourd\'hui');
      }
      
      const now = new Date();
      const checkInTime = new Date(attendance.check_in).getTime();
      const workHours = (now.getTime() - checkInTime) / (1000 * 60 * 60);
      
      await strapi.db.query('api::attendance.attendance').update({
        where: { id: attendance.id },
        data: {
          check_out: now,
          work_hours: workHours
        }
      });
      
      return ctx.send({
        success: true,
        message: 'Check-out effectué avec succès',
        data: { 
          workHours: parseFloat(workHours.toFixed(2))
        }
      });
      
    } catch (error) {
      console.error('Erreur dans checkOut:', error);
      return ctx.badRequest('Erreur lors du check-out');
    }
  },
  
  /**
   * Générer le rapport des présences
   */
  async generateReport(ctx) {
    try {
      const { user } = ctx.state;
      const { userId, month, year } = ctx.request.query;
      
      if (!user) {
        return ctx.unauthorized('Vous devez être connecté');
      }
      
      const userRole = user.role?.name?.toLowerCase();
      let targetUserId = user.id;
      
      // Vérifier les droits
      if ((userRole === 'manager' || userRole === 'admin') && userId) {
        targetUserId = typeof userId === 'string' ? parseInt(userId, 10) : Number(userId);
      }
      
      // ✅ CORRECTION: Conversion sécurisée des paramètres
      let targetMonth = DateTime.now().month;
      let targetYear = DateTime.now().year;
      
      if (month) {
        const monthValue = typeof month === 'string' ? parseInt(month, 10) : Number(month);
        targetMonth = isNaN(monthValue) ? DateTime.now().month : monthValue;
      }
      
      if (year) {
        const yearValue = typeof year === 'string' ? parseInt(year, 10) : Number(year);
        targetYear = isNaN(yearValue) ? DateTime.now().year : yearValue;
      }
      
      const startOfMonth = DateTime.fromObject({ year: targetYear, month: targetMonth, day: 1 }).startOf('month');
      const endOfMonth = startOfMonth.endOf('month');
      
      // Récupérer les présences du mois
      const attendances = await strapi.db.query('api::attendance.attendance').findMany({
        where: {
          users_permissions_user: targetUserId,
          date: {
            $gte: startOfMonth.toJSDate(),
            $lte: endOfMonth.toJSDate()
          }
        },
        orderBy: { date: 'asc' }
      });
      
      const stats = calculateStats(attendances);
      
      // Récupérer l'utilisateur
      const targetUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: targetUserId }
      });
      
      if (!targetUser) {
        return ctx.notFound('Utilisateur non trouvé');
      }
      
      // Retourner les données JSON
      return ctx.send({
        success: true,
        message: 'Données du rapport générées avec succès',
        data: {
          user: {
            id: targetUser.id,
            username: targetUser.username,
            email: targetUser.email,
            firstname: targetUser.firstname,
            lastname: targetUser.lastname
          },
          month: startOfMonth.toFormat('MMMM yyyy'),
          period: {
            start: startOfMonth.toISODate(),
            end: endOfMonth.toISODate()
          },
          attendances: attendances.map(a => ({
            id: a.id,
            date: a.date,
            check_in: a.check_in,
            check_out: a.check_out,
            statuts: a.statuts,
            work_hours: a.work_hours,
            late_minutes: a.check_in_late_minutes
          })),
          stats
        }
      });
      
    } catch (error) {
      console.error('Erreur dans generateReport:', error);
      return ctx.badRequest('Erreur lors de la génération du rapport');
    }
  }
}));