// src/api/dashboard/controllers/dashboard.ts
import { DateTime } from 'luxon';
import type { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Extrait l'utilisateur depuis le token JWT
   */
  async getCurrentUser(ctx: any) {
    // Essayer d'abord de prendre l'utilisateur du state (si auth est activée)
    if (ctx.state.user) {
      return ctx.state.user;
    }
    
    // Sinon, extraire du header Authorization
    const authHeader = ctx.request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('⚠️ Aucun token trouvé');
      return null;
    }
    
    const token = authHeader.substring(7);
    
    try {
      // Décoder le token JWT
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
      
      console.log('🔍 Token décodé:', decoded.id);
      
      // Récupérer l'utilisateur depuis la base de données
      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: decoded.id }
      });
      
      if (!user) {
        console.log('⚠️ Utilisateur non trouvé pour id:', decoded.id);
        return null;
      }
      
      console.log('✅ Utilisateur trouvé:', user.id, user.username);
      return user;
      
    } catch (error) {
      console.error('❌ Erreur décodage token:', error.message);
      return null;
    }
  },
  
  /**
   * GET /api/dashboard/today
   */
  async getToday(ctx: any) {
    const user = await this.getCurrentUser(ctx);
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    console.log('📅 [getToday] Utilisateur:', user.id, user.username);
    
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    try {
      // Récupérer l'attendance du jour
      const attendance = await strapi.db.query('api::attendance.attendance').findOne({
        where: {
          users_permissions_user: user.id,
          date: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        }
      });
      
      console.log('📊 Attendance trouvée:', attendance ? `ID ${attendance.id}` : 'NON');
      
      // Récupérer le time log actif
      const activeTimeLog = await strapi.db.query('api::time-log.time-log').findOne({
        where: {
          user: user.id,
          statuts: { $in: ['ACTIVE', 'PAUSED'] }
        }
      });
      
      // Récupérer la pause active
      const activeBreak = activeTimeLog ? await strapi.db.query('api::break.break').findOne({
        where: {
          users_permissions_user: user.id,
          statuts: 'ACTIVE'
        }
      }) : null;
      
      // Calculer les heures travaillées
      let workHoursToday = 0;
      let breakHoursToday = 0;
      
      if (attendance) {
        const breaks = await strapi.db.query('api::break.break').findMany({
          where: {
            users_permissions_user: user.id,
            start_time: {
              $gte: startOfDay,
              $lte: endOfDay
            },
            statuts: 'ENDED'
          }
        });
        
        const endTime = attendance.check_out || new Date();
        const workMs = new Date(endTime).getTime() - new Date(attendance.check_in).getTime();
        const breakMs = breaks.reduce((total: number, b: any) => total + (b.duration_minutes * 60 * 1000), 0);
        workHoursToday = (workMs - breakMs) / (1000 * 60 * 60);
        breakHoursToday = breaks.reduce((total: number, b: any) => total + b.duration_minutes, 0) / 60;
      }
      
      const responseData = {
        success: true,
        data: {
          date: DateTime.now().toISODate(),
          attendance: {
            id: attendance?.id || null,
            checkIn: attendance?.check_in || null,
            checkOut: attendance?.check_out || null,
            status: attendance?.statuts || 'ABSENT',
            isLate: (attendance?.check_in_late_minutes || 0) > 0,
            lateMinutes: attendance?.check_in_late_minutes || 0,
            workHours: parseFloat(workHoursToday.toFixed(2)),
            breakHours: parseFloat(breakHoursToday.toFixed(2)),
            expectedHours: 8
          },
          currentSession: activeTimeLog ? {
            id: activeTimeLog.id,
            status: activeTimeLog.statuts,
            startTime: activeTimeLog.start_time,
            isOnBreak: !!activeBreak,
            breakInfo: activeBreak ? {
              id: activeBreak.id,
              type: activeBreak.type,
              startTime: activeBreak.start_time,
              duration: Math.floor((new Date().getTime() - new Date(activeBreak.start_time).getTime()) / 60000)
            } : null
          } : null,
          actions: {
            canCheckIn: !attendance,
            canCheckOut: attendance && !attendance.check_out,
            canStartBreak: activeTimeLog && activeTimeLog.statuts === 'ACTIVE' && !activeBreak,
            canEndBreak: !!activeBreak
          }
        }
      };
      
      return ctx.send(responseData);
      
    } catch (error) {
      console.error('❌ Error in getToday:', error);
      return ctx.badRequest('Erreur lors de la récupération des données', { 
        error: (error as Error).message
      });
    }
  },
  
  /**
   * POST /api/dashboard/check-in
   */
 // src/api/dashboard/controllers/dashboard.ts
// Assure-toi que la méthode checkIn crée bien le time log

async checkIn(ctx: any) {
  const user = await this.getCurrentUser(ctx);
  
  if (!user) {
    return ctx.unauthorized('Vous devez être connecté');
  }
  
  console.log('✅ [checkIn] Utilisateur:', user.id, user.username);
  
  try {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    const existingAttendance = await strapi.db.query('api::attendance.attendance').findOne({
      where: {
        users_permissions_user: user.id,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      }
    });
    
    if (existingAttendance) {
      return ctx.badRequest('Vous avez déjà pointé aujourd\'hui');
    }
    
    const now = new Date();
    
    // Vérifier le retard (9h)
    const expectedTime = new Date(now);
    expectedTime.setHours(9, 0, 0, 0);
    const isLate = now > expectedTime;
    const lateMinutes = isLate ? Math.floor((now.getTime() - expectedTime.getTime()) / 60000) : 0;
    
    // Créer l'attendance
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
    
    console.log('✅ Attendance créée:', attendance.id);
    
    // CRÉER LE TIME LOG - CRUCIAL !
    const timeLog = await strapi.db.query('api::time-log.time-log').create({
      data: {
        user: user.id,
        start_time: now,
        statuts: 'ACTIVE',
        publishedAt: now
      }
    });
    
    console.log('✅ Time log créé:', timeLog.id);
    
    return ctx.send({
      success: true,
      message: 'Check-in effectué avec succès',
      data: { attendance, timeLog, isLate, lateMinutes }
    });
    
  } catch (error) {
    console.error('❌ Error in checkIn:', error);
    return ctx.badRequest('Erreur lors du check-in: ' + error.message);
  }
},
  
  /**
   * PUT /api/dashboard/check-out
   */
  async checkOut(ctx: any) {
    const user = await this.getCurrentUser(ctx);
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    console.log('🏠 [checkOut] Utilisateur:', user.id, user.username);
    
    try {
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      
      const attendance = await strapi.db.query('api::attendance.attendance').findOne({
        where: {
          users_permissions_user: user.id,
          date: {
            $gte: startOfDay,
            $lte: endOfDay
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
      
      const activeTimeLog = await strapi.db.query('api::time-log.time-log').findOne({
        where: {
          user: user.id,
          statuts: { $in: ['ACTIVE', 'PAUSED'] }
        }
      });
      
      if (activeTimeLog) {
        await strapi.db.query('api::time-log.time-log').update({
          where: { id: activeTimeLog.id },
          data: {
            end_time: now,
            statuts: 'FINISHED',
            net_work_minutes: workHours * 60
          }
        });
      }
      
      return ctx.send({
        success: true,
        message: 'Check-out effectué avec succès',
        data: { workHours: parseFloat(workHours.toFixed(2)) }
      });
      
    } catch (error) {
      console.error('❌ Error in checkOut:', error);
      return ctx.badRequest('Erreur lors du check-out');
    }
  },
  
  /**
   * GET /api/dashboard/weekly-stats
   */
  async getWeeklyStats(ctx: any) {
    const user = await this.getCurrentUser(ctx);
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    console.log('📊 [getWeeklyStats] Utilisateur:', user.id, user.username);
    
    const startOfWeek = DateTime.now().startOf('week');
    const endOfWeek = DateTime.now().endOf('week');
    
    try {
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
        if (attendance.check_out) {
          const workHours = (new Date(attendance.check_out).getTime() - new Date(attendance.check_in).getTime()) / (1000 * 60 * 60);
          totalWorkHours += workHours;
          daysPresent++;
        }
      }
      
      return ctx.send({
        success: true,
        data: {
          totalWorkHours: parseFloat(totalWorkHours.toFixed(2)),
          daysPresent,
          averageDailyHours: daysPresent > 0 ? parseFloat((totalWorkHours / daysPresent).toFixed(2)) : 0
        }
      });
      
    } catch (error) {
      console.error('❌ Error in getWeeklyStats:', error);
      return ctx.badRequest('Erreur lors de la récupération des statistiques');
    }
  },
  
  /**
   * POST /api/dashboard/break/start
   */
  // src/api/dashboard/controllers/dashboard.ts
// Modifie la méthode startBreak comme ceci :

// src/api/dashboard/controllers/dashboard.ts
// Remplace ta méthode startBreak par celle-ci

async startBreak(ctx: any) {
  const user = await this.getCurrentUser(ctx);
  
  if (!user) {
    return ctx.unauthorized('Vous devez être connecté');
  }
  
  const { type } = ctx.request.body;
  const now = new Date();
  
  console.log('☕ [startBreak] Utilisateur:', user.id, user.username);
  
  try {
    // Vérifier si un time log actif existe
    let activeTimeLog = await strapi.db.query('api::time-log.time-log').findOne({
      where: {
        user: user.id,
        statuts: { $in: ['ACTIVE', 'PAUSED'] }
      }
    });
    
    console.log('☕ [startBreak] Time log trouvé:', activeTimeLog ? `OUI (${activeTimeLog.statuts})` : 'NON');
    
    // Si pas de time log actif, en créer un
    if (!activeTimeLog) {
      console.log('☕ Création d\'un nouveau time log...');
      
      // Vérifier si l'utilisateur a une attendance aujourd'hui
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      
      const attendance = await strapi.db.query('api::attendance.attendance').findOne({
        where: {
          users_permissions_user: user.id,
          date: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        }
      });
      
      if (!attendance) {
        return ctx.badRequest('Vous devez d\'abord faire un check-in');
      }
      
      // Créer un nouveau time log
      activeTimeLog = await strapi.db.query('api::time-log.time-log').create({
        data: {
          user: user.id,
          start_time: attendance.check_in || now,
          statuts: 'ACTIVE',
          publishedAt: now
        }
      });
      
      console.log('✅ Nouveau time log créé avec ID:', activeTimeLog.id);
    }
    
    // Vérifier si une pause est déjà active
    const activeBreak = await strapi.db.query('api::break.break').findOne({
      where: {
        users_permissions_user: user.id,
        statuts: 'ACTIVE'
      }
    });
    
    if (activeBreak) {
      return ctx.badRequest('Vous êtes déjà en pause');
    }
    
    // Créer la pause
    const breakRecord = await strapi.db.query('api::break.break').create({
      data: {
        users_permissions_user: user.id,
        time_log: activeTimeLog.id,
        start_time: now,
        type: type || 'SHORT',
        statuts: 'ACTIVE',
        publishedAt: now
      }
    });
    
    console.log('✅ Pause créée avec ID:', breakRecord.id);
    
    // Mettre à jour le time log en PAUSED
    await strapi.db.query('api::time-log.time-log').update({
      where: { id: activeTimeLog.id },
      data: { statuts: 'PAUSED' }
    });
    
    return ctx.send({
      success: true,
      message: 'Pause démarrée',
      data: breakRecord
    });
    
  } catch (error) {
    console.error('❌ Error in startBreak:', error);
    return ctx.badRequest('Erreur lors du début de la pause: ' + error.message);
  }
},
  
  /**
   * PUT /api/dashboard/break/end
   */
  async endBreak(ctx: any) {
    const user = await this.getCurrentUser(ctx);
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const now = new Date();
    
    console.log('▶️ [endBreak] Utilisateur:', user.id, user.username);
    
    try {
      // Récupérer la pause active
      const activeBreak = await strapi.db.query('api::break.break').findOne({
        where: {
          users_permissions_user: user.id,
          statuts: 'ACTIVE'
        }
      });
      
      if (!activeBreak) {
        return ctx.badRequest('Aucune pause active');
      }
      
      // Calculer la durée
      const durationMinutes = Math.floor((now.getTime() - new Date(activeBreak.start_time).getTime()) / 60000);
      
      // Terminer la pause
      await strapi.db.query('api::break.break').update({
        where: { id: activeBreak.id },
        data: {
          end_time: now,
          duration_minutes: durationMinutes,
          statuts: 'ENDED'
        }
      });
      
      // Remettre le time log en ACTIVE
      if (activeBreak.time_log) {
        await strapi.db.query('api::time-log.time-log').update({
          where: { id: activeBreak.time_log.id },
          data: { statuts: 'ACTIVE' }
        });
      }
      
      return ctx.send({
        success: true,
        message: `Pause terminée après ${durationMinutes} minutes`,
        data: { durationMinutes }
      });
      
    } catch (error) {
      console.error('❌ Error in endBreak:', error);
      return ctx.badRequest('Erreur lors de la fin de la pause');
    }
  },
  
  /**
   * GET /api/dashboard/break/active
   */
  async getActiveBreak(ctx: any) {
    const user = await this.getCurrentUser(ctx);
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    try {
      const activeBreak = await strapi.db.query('api::break.break').findOne({
        where: {
          users_permissions_user: user.id,
          statuts: 'ACTIVE'
        }
      });
      
      if (activeBreak) {
        const duration = Math.floor((new Date().getTime() - new Date(activeBreak.start_time).getTime()) / 60000);
        return ctx.send({
          success: true,
          data: {
            ...activeBreak,
            duration
          }
        });
      }
      
      return ctx.send({
        success: true,
        data: null
      });
      
    } catch (error) {
      console.error('❌ Error in getActiveBreak:', error);
      return ctx.badRequest('Erreur lors de la récupération de la pause');
    }
  }
}); // ← Fermeture correcte de l'objet exporté