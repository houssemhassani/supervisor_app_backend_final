/**
 * attendance controller
 */

import { factories } from '@strapi/strapi';
import { DateTime } from 'luxon';

export default factories.createCoreController('api::attendance.attendance', ({ strapi }) => ({
  /**
   * Récupérer les présences selon le rôle
   * - Employee: voit seulement ses propres présences
   * - Manager/Admin: voit toutes les présences
   */
  async find(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Employee ne voit que ses propres présences
    if (userRole === 'employee') {
      const { data, meta } = await super.find(ctx);
      
      // Filtrer manuellement
      const filteredData = data.filter((item: any) => item.users_permissions_user?.id === user.id);
      
      return { data: filteredData, meta };
    }
    
    // Manager et admin voient tout
    const { data, meta } = await super.find(ctx);
    return { data, meta };
  },
  
  /**
   * Créer une présence
   * - Employee: ne peut pas créer manuellement (via le dashboard check-in)
   * - Manager/Admin: peut créer pour n'importe qui
   */
  async create(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    const requestData = ctx.request.body?.data || {};
    
    // Employee ne peut pas créer manuellement
    if (userRole === 'employee') {
      return ctx.forbidden('Les employés ne peuvent pas créer manuellement des présences');
    }
    
    // Manager et admin peuvent créer
    const response = await super.create(ctx);
    return response;
  },
  
  /**
   * Mettre à jour une présence
   * - Employee: ne peut pas modifier
   * - Manager/Admin: peut modifier toutes les présences
   */
  async update(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    
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
  },
  
  /**
   * Supprimer une présence
   * - Employee: ne peut pas supprimer
   * - Manager/Admin: peut supprimer toutes les présences
   */
  async delete(ctx) {
    const { user } = ctx.state;
    const { id } = ctx.params;
    
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
  },
  
  /**
   * Récupérer la présence du jour pour l'utilisateur connecté
   */
  async getToday(ctx) {
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
  },
  
  /**
   * Récupérer les statistiques hebdomadaires pour l'utilisateur connecté
   */
  async getWeeklyStats(ctx) {
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
      if (attendance.check_out) {
        const workHours = (new Date(attendance.check_out).getTime() - new Date(attendance.check_in).getTime()) / (1000 * 60 * 60);
        totalWorkHours += workHours;
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
  },
  
  /**
   * Pointer arrivée (Check-in)
   */
  async checkIn(ctx) {
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
  },
  
  /**
   * Pointer sortie (Check-out)
   */
  async checkOut(ctx) {
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
  }
}));