/**
 * attendance controller
 */

import { factories } from '@strapi/strapi';
import { DateTime } from 'luxon';

// Fonction utilitaire pour calculer les statistiques
const calculateStats = (attendances: any[]) => {
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
  async find(ctx: any) {
    try {
      const { user } = ctx.state;
      
      // Construction de la requête
      const query: any = {};
      
      // Si utilisateur connecté et rôle employee, filtrer par son ID
      if (user && user.role?.name?.toLowerCase() === 'employee') {
        query.where = {
          users_permissions_user: user.id
        };
      }
      
      // Récupérer les présences avec la relation
      const attendances = await strapi.db.query('api::attendance.attendance').findMany({
        where: query.where || {},
        orderBy: { date: 'desc' },
        populate: {
          users_permissions_user: true
        }
      });
      
      // Formater la réponse comme Strapi
      const data = attendances.map((a: any) => ({
        id: a.id,
        attributes: {
          ...a,
          users_permissions_user: {
            id: a.users_permissions_user?.id,
            username: a.users_permissions_user?.username,
            email: a.users_permissions_user?.email
          }
        }
      }));
      
      return {
        data,
        meta: { pagination: { total: attendances.length, page: 1, pageSize: 100, pageCount: 1 } }
      };
      
    } catch (error) {
      console.error('Erreur dans find:', error);
      return ctx.badRequest('Erreur lors de la récupération des présences');
    }
  },
  
  /**
   * Créer une présence
   */
  async create(ctx: any) {
    try {
      const { user } = ctx.state;
      
      if (!user) {
        return ctx.unauthorized('Vous devez être connecté');
      }
      
      const userRole = user.role?.name?.toLowerCase();
      
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
  async update(ctx: any) {
    try {
      const { user } = ctx.state;
      
      if (!user) {
        return ctx.unauthorized('Vous devez être connecté');
      }
      
      const userRole = user.role?.name?.toLowerCase();
      
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
  async delete(ctx: any) {
    try {
      const { user } = ctx.state;
      
      if (!user) {
        return ctx.unauthorized('Vous devez être connecté');
      }
      
      const userRole = user.role?.name?.toLowerCase();
      
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
   * Récupérer la présence du jour
   */
  async getToday(ctx: any) {
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
        },
        populate: {
          users_permissions_user: true
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
   * Récupérer les statistiques hebdomadaires
   */
  async getWeeklyStats(ctx: any) {
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
          const workHours = (new Date(attendance.check_out).getTime() - new Date(attendance.check_in).getTime()) / (1000 * 60 * 60);
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
  async getMonthlyStats(ctx: any) {
    try {
      const { user } = ctx.state;
      const { userId, month, year } = ctx.request.query;
      
      if (!user) {
        return ctx.unauthorized('Vous devez être connecté');
      }
      
      const userRole = user.role?.name?.toLowerCase();
      let targetUserId = user.id;
      
      if ((userRole === 'manager' || userRole === 'admin') && userId) {
        targetUserId = typeof userId === 'string' ? parseInt(userId, 10) : Number(userId);
      }
      
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
  async checkIn(ctx: any) {
    try {
      const { user } = ctx.state;
      
      if (!user) {
        return ctx.unauthorized('Vous devez être connecté');
      }
      
      const now = new Date();
      const today = DateTime.now().toISODate();
      
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
      
      const expectedTime = new Date(now);
      expectedTime.setHours(9, 0, 0, 0);
      const isLate = now > expectedTime;
      const lateMinutes = isLate ? Math.floor((now.getTime() - expectedTime.getTime()) / 60000) : 0;
      
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
  async checkOut(ctx: any) {
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
      const workHours = (now.getTime() - new Date(attendance.check_in).getTime()) / (1000 * 60 * 60);
      
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
        data: { workHours: parseFloat(workHours.toFixed(2)) }
      });
      
    } catch (error) {
      console.error('Erreur dans checkOut:', error);
      return ctx.badRequest('Erreur lors du check-out');
    }
  },

  /**
   * Exporter les présences en PDF
   */
  async exportPDF(ctx: any) {
    try {
      const { userId, month } = ctx.request.query;
      const { user } = ctx.state;
      
      if (!user) {
        return ctx.unauthorized('Vous devez être connecté');
      }
      
      if (!userId || !month) {
        return ctx.badRequest('Les paramètres userId et month sont requis');
      }
      
      const userRole = user.role?.name?.toLowerCase();
      
      const userIdStr = typeof userId === 'string' ? userId : String(userId);
      const currentUserIdStr = String(user.id);
      
      if (userRole !== 'manager' && userRole !== 'admin' && currentUserIdStr !== userIdStr) {
        return ctx.forbidden('Vous n\'avez pas les droits pour exporter ces données');
      }
      
      const targetUserId = typeof userId === 'string' ? parseInt(userId, 10) : Number(userId);
      const targetUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: targetUserId }
      });
      
      if (!targetUser) {
        return ctx.notFound('Utilisateur non trouvé');
      }
      
      const monthStr = typeof month === 'string' ? month : String(month);
      const [year, monthNum] = monthStr.split('-');
      const startDate = `${year}-${monthNum}-01`;
      const endDate = new Date(parseInt(year, 10), parseInt(monthNum, 10), 0).toISOString().split('T')[0];
      
      const attendances = await strapi.db.query('api::attendance.attendance').findMany({
        where: {
          users_permissions_user: targetUserId,
          date: {
            $gte: new Date(`${startDate}T00:00:00.000Z`),
            $lte: new Date(`${endDate}T23:59:59.999Z`)
          }
        },
        orderBy: { date: 'asc' }
      });
      
      const stats = calculateStats(attendances);
      
      return ctx.send({
        success: true,
        message: 'Données exportées avec succès',
        data: {
          user: {
            id: targetUser.id,
            username: targetUser.username,
            email: targetUser.email
          },
          month: monthStr,
          attendances: attendances.map((a: any) => ({
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
      console.error('Erreur dans exportPDF:', error);
      return ctx.badRequest('Erreur lors de l\'export PDF');
    }
  }
}));