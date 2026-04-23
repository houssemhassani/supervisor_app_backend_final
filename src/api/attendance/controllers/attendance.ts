/**
 * attendance controller
 */

import { factories } from '@strapi/strapi';
import { DateTime } from 'luxon';

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

  for (const a of attendances) {
    switch (a.statuts) {
      case 'PRESENT': stats.presentDays++; break;
      case 'ABSENT': stats.absentDays++; break;
      case 'LATE': stats.lateDays++; stats.presentDays++; break;
      case 'HALF_DAY': stats.halfDays++; break;
      case 'HOLIDAY': stats.holidayDays++; break;
    }

    if (a.work_hours) {
      stats.totalWorkHours += Number(a.work_hours);
    }
  }

  stats.totalWorkHours = Number(stats.totalWorkHours.toFixed(2));
  return stats;
};

export default factories.createCoreController('api::attendance.attendance', ({ strapi }) => ({

  // ========================= FIND =========================
  async find(ctx: any) {
    try {
      const user = ctx.state.user;

      const filters: any = {};

      if (user && user.role?.name?.toLowerCase() === 'employee') {
        filters.users_permissions_user = user.id;
      }

      const data = await strapi.entityService.findMany('api::attendance.attendance', {
        filters,
        sort: { date: 'desc' },
        populate: ['users_permissions_user']
      });

      return { data };

    } catch (e) {
      console.error(e);
      return ctx.badRequest('Erreur récupération');
    }
  },

  // ========================= CREATE =========================
  async create(ctx: any) {
    try {
      const user = ctx.state.user;

      if (!user) return ctx.unauthorized();

      if (user.role?.name?.toLowerCase() === 'employee') {
        return ctx.forbidden('Non autorisé');
      }

      const data = await strapi.entityService.create('api::attendance.attendance', {
        data: ctx.request.body.data
      });

      return { data };

    } catch (e) {
      console.error(e);
      return ctx.badRequest('Erreur création');
    }
  },
async exportPDF(ctx: any) {
  try {
    const { userId, month } = ctx.request.query;

    if (!userId || !month) {
      return ctx.badRequest('Missing params');
    }

    const [year, m] = month.split('-');

    const start = new Date(+year, +m - 1, 1);
    const end = new Date(+year, +m, 0);

    const attendances = await strapi.db.query('api::attendance.attendance').findMany({
      where: {
        users_permissions_user: userId,
        date: {
          $between: [start, end]
        }
      }
    });

    // 👉 simple JSON export (test)
    // (on peut upgrader vers PDF après)
    return ctx.send({
      data: attendances
    });

  } catch (err) {
    console.error(err);
    return ctx.internalServerError('Export failed');
  }
},

  // ========================= UPDATE =========================
  async update(ctx: any) {
    try {
      const user = ctx.state.user;
      const { id } = ctx.params;

      if (!user) return ctx.unauthorized();

      if (user.role?.name?.toLowerCase() === 'employee') {
        return ctx.forbidden();
      }

      const data = await strapi.entityService.update('api::attendance.attendance', id, {
        data: ctx.request.body.data
      });

      return { data };

    } catch (e) {
      console.error(e);
      return ctx.badRequest('Erreur update');
    }
  },

  // ========================= DELETE =========================
  async delete(ctx: any) {
    try {
      const user = ctx.state.user;
      const { id } = ctx.params;

      if (!user) return ctx.unauthorized();

      if (user.role?.name?.toLowerCase() === 'employee') {
        return ctx.forbidden();
      }

      const data = await strapi.entityService.delete('api::attendance.attendance', id);

      return { data };

    } catch (e) {
      console.error(e);
      return ctx.badRequest('Erreur delete');
    }
  },
    async getWeeklyStats(ctx: any) {
  },

  // ========================= TODAY =========================
  async getToday(ctx: any) {
    try {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized();

      const today = DateTime.now();

      const data = await strapi.db.query('api::attendance.attendance').findOne({
        where: {
          users_permissions_user: user.id,
          date: {
            $between: [
              today.startOf('day').toJSDate(),
              today.endOf('day').toJSDate()
            ]
          }
        }
      });

      return { data: data || null };

    } catch (e) {
      console.error(e);
      return ctx.badRequest('Erreur today');
    }
  },

  // ========================= CHECK-IN =========================
  async checkIn(ctx: any) {
    try {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized();

      const now = DateTime.now();

      const existing = await strapi.db.query('api::attendance.attendance').findOne({
        where: {
          users_permissions_user: user.id,
          date: {
            $between: [
              now.startOf('day').toJSDate(),
              now.endOf('day').toJSDate()
            ]
          }
        }
      });

      if (existing) {
        return ctx.badRequest('Déjà pointé');
      }

      const expected = now.set({ hour: 9, minute: 0 });
      const isLate = now > expected;

      const lateMinutes = isLate
        ? Math.floor(now.diff(expected, 'minutes').minutes)
        : 0;

      const attendance = await strapi.entityService.create('api::attendance.attendance', {
        data: {
          users_permissions_user: user.id,
          date: now.toJSDate(),
          check_in: now.toJSDate(),
          statuts: isLate ? 'LATE' : 'PRESENT',
          check_in_late_minutes: lateMinutes,
          work_hours: 0
        }
      });

      return {
        success: true,
        data: attendance
      };

    } catch (e) {
      console.error(e);
      return ctx.badRequest('Erreur check-in');
    }
  },

  // ========================= CHECK-OUT =========================
  async checkOut(ctx: any) {
    try {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized();

      const now = DateTime.now();

      const attendance = await strapi.db.query('api::attendance.attendance').findOne({
        where: {
          users_permissions_user: user.id,
          check_out: null,
          date: {
            $between: [
              now.startOf('day').toJSDate(),
              now.endOf('day').toJSDate()
            ]
          }
        }
      });

      if (!attendance) {
        return ctx.badRequest('Pas de check-in');
      }

      const workHours =
        (now.toMillis() - new Date(attendance.check_in).getTime()) / 3600000;

      const updated = await strapi.entityService.update(
        'api::attendance.attendance',
        attendance.id,
        {
          data: {
            check_out: now.toJSDate(),
            work_hours: Number(workHours.toFixed(2))
          }
        }
      );

      return {
        success: true,
        data: updated
      };

    } catch (e) {
      console.error(e);
      return ctx.badRequest('Erreur check-out');
    }
  },

  // ========================= MONTHLY STATS =========================
  async getMonthlyStats(ctx: any) {
    try {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized();

      const { month, year } = ctx.request.query;

      const m = Number(month) || DateTime.now().month;
      const y = Number(year) || DateTime.now().year;

      const start = DateTime.fromObject({ year: y, month: m }).startOf('month');
      const end = start.endOf('month');

      const attendances = await strapi.db.query('api::attendance.attendance').findMany({
        where: {
          users_permissions_user: user.id,
          date: {
            $between: [start.toJSDate(), end.toJSDate()]
          }
        }
      });

      const stats = calculateStats(attendances);

      return {
        data: {
          month: start.toFormat('MMMM yyyy'),
          stats
        }
      };

    } catch (e) {
      console.error(e);
      return ctx.badRequest('Erreur stats');
    }
  },
async findByEmployee(ctx: any) {
  try {
    const { employeeId } = ctx.params;

    if (!employeeId) {
      return ctx.badRequest('employeeId requis');
    }

    const data = await strapi.entityService.findMany(
      'api::attendance.attendance',
      {
        filters: {
          users_permissions_user: {
            id: Number(employeeId)
          }
        },
        sort: { date: 'desc' },
        populate: ['users_permissions_user']
      }
    );

    return { data };

  } catch (e) {
    console.error('findByEmployee error:', e);
    return ctx.badRequest('Erreur get attendances employee');
  }
},

async findByEmployeeMonth(ctx: any) {
  try {
    const { employeeId } = ctx.params;
    const { month, year } = ctx.query;

    if (!employeeId) {
      return ctx.badRequest('employeeId requis');
    }

    const m = Number(month) || DateTime.now().month;
    const y = Number(year) || DateTime.now().year;

    const start = DateTime.fromObject({
      year: y,
      month: m,
      day: 1
    }).startOf('month');

    const end = start.endOf('month');

    const data = await strapi.entityService.findMany(
      'api::attendance.attendance',
      {
        filters: {
          users_permissions_user: {
            id: Number(employeeId)
          },
          date: {
            $gte: start.toJSDate(),
            $lte: end.toJSDate()
          }
        },
        sort: { date: 'desc' },
        populate: ['users_permissions_user']
      }
    );

    return { data };

  } catch (e) {
    console.error('findByEmployeeMonth error:', e);
    return ctx.badRequest('Erreur filter month');
  }
}

}));