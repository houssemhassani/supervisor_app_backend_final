/**
 * attendance controller
 */

import { factories } from '@strapi/strapi';
import { DateTime } from 'luxon';
 import PDFDocument from 'pdfkit';


const calculateStats = (attendances, totalWorkingDays = null) => {
  const stats = {
    totalDays: attendances.length,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    halfDays: 0,
    holidayDays: 0,
    totalWorkHours: 0,
    attendanceRate: 0
  };

  for (const a of attendances) {
    switch (a.statuts) {
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

    if (a.work_hours) {
      stats.totalWorkHours += Number(a.work_hours);
    }
  }

  const baseDays = totalWorkingDays || (stats.presentDays + stats.absentDays + stats.halfDays);
  stats.attendanceRate = baseDays > 0 ? Math.round((stats.presentDays / baseDays) * 100) : 0;
  stats.totalWorkHours = Number(stats.totalWorkHours.toFixed(2));
  
  return stats;
};

export default factories.createCoreController('api::attendance.attendance', ({ strapi }) => ({

  // ========================= GET ALL EMPLOYEES WITH MONTHLY ATTENDANCES =========================
  async getAllEmployeesWithAttendances(ctx: any) {
    try {
      const user = ctx.state.user;
      
      if (user && user.role?.name?.toLowerCase() === 'employee') {
        return ctx.forbidden('Accès non autorisé');
      }

      const { month, status } = ctx.query;
      
      let targetMonth = DateTime.now().month;
      let targetYear = DateTime.now().year;
      
      if (month && month.includes('-')) {
        const [y, m] = month.split('-');
        targetYear = parseInt(y);
        targetMonth = parseInt(m);
      } else if (month) {
        targetMonth = parseInt(month);
      }
      
      const startDate = DateTime.fromObject({ year: targetYear, month: targetMonth, day: 1 }).startOf('month');
      const endDate = startDate.endOf('month');
      
      const employees = await strapi.entityService.findMany('plugin::users-permissions.user', {
        filters: {
          role: {
            name: {
              $eq: 'employee'
            }
          }
        },
        populate: ['role']
      });
      
      const employeesWithAttendances = [];
      
      for (const employee of employees) {
        const attendanceFilters = {
          users_permissions_user: {
            id: employee.id
          },
          date: {
            $gte: startDate.toJSDate(),
            $lte: endDate.toJSDate()
          }
        };
        
        let attendances = await strapi.db.query('api::attendance.attendance').findMany({
          where: attendanceFilters,
          orderBy: { date: 'desc' }
        });
        
        if (status && status !== 'ALL') {
          attendances = attendances.filter(a => a.statuts === status);
        }
        
        const stats = calculateStats(attendances);
        
        employeesWithAttendances.push({
          id: employee.id,
          username: employee.username,
          email: employee.email,
          
          position: employee.position || 'Employé',
          attendances: attendances.map(a => ({
            id: a.id,
            date: a.date,
            check_in: a.check_in,
            check_out: a.check_out,
            work_hours: a.work_hours,
            statuts: a.statuts,
            check_in_late_minutes: a.check_in_late_minutes,
            notes: a.notes || ''
          })),
          stats: {
            totalDays: stats.totalDays,
            presentDays: stats.presentDays,
            absentDays: stats.absentDays,
            lateDays: stats.lateDays,
            halfDays: stats.halfDays,
            holidayDays: stats.holidayDays,
            totalWorkHours: stats.totalWorkHours,
            attendanceRate: stats.attendanceRate
          }
        });
      }
      
      const today = DateTime.now();
      const todayStart = today.startOf('day');
      const todayEnd = today.endOf('day');
      
      const todayAttendances = await strapi.db.query('api::attendance.attendance').findMany({
        where: {
          date: {
            $gte: todayStart.toJSDate(),
            $lte: todayEnd.toJSDate()
          }
        }
      });
      
      const presentToday = todayAttendances.filter(a => a.statuts === 'PRESENT' || a.statuts === 'LATE').length;
      const absentToday = todayAttendances.filter(a => a.statuts === 'ABSENT').length;
      const lateToday = todayAttendances.filter(a => a.statuts === 'LATE').length;
      
      const allAttendancesMonth = await strapi.db.query('api::attendance.attendance').findMany({
        where: {
          date: {
            $gte: startDate.toJSDate(),
            $lte: endDate.toJSDate()
          }
        }
      });
      
      const globalStats = calculateStats(allAttendancesMonth);
      
      return {
        data: {
          employees: employeesWithAttendances,
          summary: {
            totalEmployees: employees.length,
            presentToday,
            absentToday,
            lateToday,
            avgAttendanceRate: globalStats.attendanceRate
          },
          currentMonth: {
            year: targetYear,
            month: targetMonth,
            monthName: startDate.toFormat('MMMM yyyy')
          }
        }
      };
      
    } catch (error) {
      console.error('getAllEmployeesWithAttendances error:', error);
      return ctx.internalServerError('Erreur lors de la récupération des données');
    }
  },
  
  // ========================= GET EMPLOYEE ATTENDANCES BY MONTH =========================
  async getEmployeeAttendancesByMonth(ctx: any) {
    try {
      const user = ctx.state.user;
      const { employeeId } = ctx.params;
      const { month, status } = ctx.query;
      
      if (user && user.role?.name?.toLowerCase() === 'employee' && user.id != employeeId) {
        return ctx.forbidden('Accès non autorisé');
      }
      
      if (!employeeId) {
        return ctx.badRequest('employeeId requis');
      }
      
      let targetMonth = DateTime.now().month;
      let targetYear = DateTime.now().year;
      
      if (month && month.includes('-')) {
        const [y, m] = month.split('-');
        targetYear = parseInt(y);
        targetMonth = parseInt(m);
      } else if (month) {
        targetMonth = parseInt(month);
      }
      
      const startDate = DateTime.fromObject({ year: targetYear, month: targetMonth, day: 1 }).startOf('month');
      const endDate = startDate.endOf('month');
      
      let attendances = await strapi.db.query('api::attendance.attendance').findMany({
        where: {
          users_permissions_user: {
            id: parseInt(employeeId)
          },
          date: {
            $gte: startDate.toJSDate(),
            $lte: endDate.toJSDate()
          }
        },
        orderBy: { date: 'desc' }
      });
      
      if (status && status !== 'ALL') {
        attendances = attendances.filter(a => a.statuts === status);
      }
      
      const stats = calculateStats(attendances);
      
      const employee = await strapi.entityService.findOne('plugin::users-permissions.user', employeeId);
      
      return {
        data: {
          employee: {
            id: employee.id,
            username: employee.username,
            email: employee.email,
       
          },
          attendances: attendances.map(a => ({
            id: a.id,
            date: a.date,
            check_in: a.check_in,
            check_out: a.check_out,
            work_hours: a.work_hours,
            statuts: a.statuts,
            check_in_late_minutes: a.check_in_late_minutes,
            notes: a.notes || ''
          })),
          stats: {
            totalDays: stats.totalDays,
            presentDays: stats.presentDays,
            absentDays: stats.absentDays,
            lateDays: stats.lateDays,
            halfDays: stats.halfDays,
            holidayDays: stats.holidayDays,
            totalWorkHours: stats.totalWorkHours,
            attendanceRate: stats.attendanceRate
          },
          month: {
            year: targetYear,
            month: targetMonth,
            monthName: startDate.toFormat('MMMM yyyy')
          }
        }
      };
      
    } catch (error) {
      console.error('getEmployeeAttendancesByMonth error:', error);
      return ctx.internalServerError('Erreur lors de la récupération des présences');
    }
  },
  
  // ========================= GET ALL EMPLOYEES (SIMPLE LIST) =========================
  async getAllEmployees(ctx: any) {
    try {
      const user = ctx.state.user;
      
      if (user && user.role?.name?.toLowerCase() === 'employee') {
        return ctx.forbidden('Accès non autorisé');
      }
      
      const employees = await strapi.entityService.findMany('plugin::users-permissions.user', {
        filters: {
          role: {
            name: {
              $eq: 'Employee'
            }
          }
        },
        fields: ['id', 'username', 'email', 'position'],
        populate: ['role']
      });
      
      return {
        data: employees.map(emp => ({
          id: emp.id,
          username: emp.username,
          email: emp.email,

          position: emp.position || 'Employé'
        }))
      };
      
    } catch (error) {
      console.error('getAllEmployees error:', error);
      return ctx.internalServerError('Erreur lors de la récupération des employés');
    }
  },

  // ========================= FIND BY EMPLOYEE (pour compatibilité) =========================
  async findByEmployee(ctx: any) {
    try {
      const { employeeId } = ctx.params;
      const { month, status } = ctx.query;

      if (!employeeId) {
        return ctx.badRequest('employeeId requis');
      }

      let targetMonth = DateTime.now().month;
      let targetYear = DateTime.now().year;
      
      if (month && month.includes('-')) {
        const [y, m] = month.split('-');
        targetYear = parseInt(y);
        targetMonth = parseInt(m);
      } else if (month) {
        targetMonth = parseInt(month);
      }
      
      const startDate = DateTime.fromObject({ year: targetYear, month: targetMonth, day: 1 }).startOf('month');
      const endDate = startDate.endOf('month');
      
      let attendances = await strapi.db.query('api::attendance.attendance').findMany({
        where: {
          users_permissions_user: {
            id: parseInt(employeeId)
          },
          date: {
            $gte: startDate.toJSDate(),
            $lte: endDate.toJSDate()
          }
        },
        orderBy: { date: 'desc' }
      });
      
      if (status && status !== 'ALL') {
        attendances = attendances.filter(a => a.statuts === status);
      }
      
      return { 
        data: attendances.map(a => ({
          id: a.id,
          date: a.date,
          check_in: a.check_in,
          check_out: a.check_out,
          work_hours: a.work_hours,
          statuts: a.statuts,
          check_in_late_minutes: a.check_in_late_minutes,
          notes: a.notes || ''
        }))
      };

    } catch (e) {
      console.error('findByEmployee error:', e);
      return ctx.badRequest('Erreur get attendances employee');
    }
  },

  // ========================= FIND BY EMPLOYEE MONTH =========================
  async findByEmployeeMonth(ctx: any) {
    try {
      const { employeeId } = ctx.params;
      const { month, year } = ctx.query;

      if (!employeeId) {
        return ctx.badRequest('employeeId requis');
      }

      const m = parseInt(month) || DateTime.now().month;
      const y = parseInt(year) || DateTime.now().year;

      const start = DateTime.fromObject({
        year: y,
        month: m,
        day: 1
      }).startOf('month');

      const end = start.endOf('month');

      const attendances = await strapi.db.query('api::attendance.attendance').findMany({
        where: {
          users_permissions_user: {
            id: parseInt(employeeId)
          },
          date: {
            $gte: start.toJSDate(),
            $lte: end.toJSDate()
          }
        },
        orderBy: { date: 'desc' }
      });

      const stats = calculateStats(attendances);

      return { 
        data: {
          attendances: attendances.map(a => ({
            id: a.id,
            date: a.date,
            check_in: a.check_in,
            check_out: a.check_out,
            work_hours: a.work_hours,
            statuts: a.statuts,
            check_in_late_minutes: a.check_in_late_minutes,
            notes: a.notes || ''
          })),
          stats
        }
      };

    } catch (e) {
      console.error('findByEmployeeMonth error:', e);
      return ctx.badRequest('Erreur filter month');
    }
  },

  // ========================= FIND ALL (with filters) =========================
  async find(ctx: any) {
    try {
      const user = ctx.state.user;
      const { month, year, status, employeeId } = ctx.query;

      let filters: any = {};

      if (user && user.role?.name?.toLowerCase() === 'employee') {
        filters.users_permissions_user = user.id;
      }
      
      if (employeeId && user?.role?.name?.toLowerCase() !== 'employee') {
        filters.users_permissions_user = { id: parseInt(employeeId) };
      }

      if (month && year) {
        const startDate = DateTime.fromObject({ 
          year: parseInt(year), 
          month: parseInt(month), 
          day: 1 
        }).startOf('month');
        const endDate = startDate.endOf('month');
        
        filters.date = {
          $gte: startDate.toJSDate(),
          $lte: endDate.toJSDate()
        };
      } else if (month && month.includes('-')) {
        const [y, m] = month.split('-');
        const startDate = DateTime.fromObject({ 
          year: parseInt(y), 
          month: parseInt(m), 
          day: 1 
        }).startOf('month');
        const endDate = startDate.endOf('month');
        
        filters.date = {
          $gte: startDate.toJSDate(),
          $lte: endDate.toJSDate()
        };
      }

      const data = await strapi.entityService.findMany('api::attendance.attendance', {
        filters,
        sort: { date: 'desc' },
        populate: ['users_permissions_user']
      });
      
      let filteredData = data;
      if (status && status !== 'ALL') {
        filteredData = data.filter(a => a.statuts === status);
      }

      return { data: filteredData };

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
    const { employeeId, month } = ctx.request.query;

    if (!employeeId || !month) {
      return ctx.badRequest('Missing params: employeeId and month required');
    }

    const [year, m] = month.split('-');

    const start = DateTime.fromObject({
      year: Number(year),
      month: Number(m),
      day: 1,
    }).startOf('month');

    const end = start.endOf('month');

    const attendances = await strapi.db
      .query('api::attendance.attendance')
      .findMany({
        where: {
          users_permissions_user: Number(employeeId),
          date: {
            $between: [start.toJSDate(), end.toJSDate()],
          },
        },
        orderBy: { date: 'asc' },
      });

    const employee = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      Number(employeeId),
      {
        fields: ['id', 'username', 'email', 'position'],
      }
    );

    if (!employee) {
      return ctx.notFound('Employee not found');
    }

    const stats = calculateStats(attendances);

    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
    });

    // Headers
    ctx.set('Content-Type', 'application/pdf');
    ctx.set(
      'Content-Disposition',
      `attachment; filename="attendance_${employee.username}_${month}.pdf"`
    );

    // ❗ IMPORTANT: PAS de ctx.body ici
    ctx.status = 200;

    // Stream direct
    doc.pipe(ctx.res);

    // PDF content
    doc.fontSize(18).text('Attendance Report', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Employee: ${employee.username}`);
    doc.text(`Email: ${employee.email}`);
    doc.text(`Month: ${month}`);
    doc.moveDown();

    doc.text('-----------------------------------');

    attendances.forEach((a) => {
      doc.text(`${a.date} | ${a.statuts ?? 'N/A'} | ${a.work_hours ?? 0}h`);
    });

    doc.text('-----------------------------------');
    doc.moveDown();

    doc.text(`Total days: ${stats.totalDays}`);
    doc.text(`Present: ${stats.presentDays}`);
    doc.text(`Absent: ${stats.absentDays}`);

    doc.end();

    return; // important
  } catch (err) {
    console.error('PDF Export Error:', err);
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

  // ========================= TODAY CHECK =========================
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

  // ========================= MONTHLY STATS FOR CURRENT USER =========================
  async getMonthlyStats(ctx: any) {
    try {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized();

      const { month, year } = ctx.request.query;

      const m = parseInt(month) || DateTime.now().month;
      const y = parseInt(year) || DateTime.now().year;

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
  
  // ========================= GET EMPLOYEE BY ID =========================
  async getEmployeeById(ctx: any) {
    try {
      const { id } = ctx.params;
      
      const employee = await strapi.entityService.findOne('plugin::users-permissions.user', id, {
        fields: ['id', 'username', 'email', 'position'],
        populate: ['role']
      });
      
      if (!employee) {
        return ctx.notFound('Employé non trouvé');
      }
      
      return {
        data: {
          id: employee.id,
          username: employee.username,
          email: employee.email,
          
          position: employee.position || 'Employé'
        }
      };
      
    } catch (error) {
      console.error('getEmployeeById error:', error);
      return ctx.internalServerError('Erreur lors de la récupération de l\'employé');
    }
  },

  // ========================= GET TODAY ATTENDANCES FOR ALL =========================
  async getTodayAttendances(ctx: any) {
    try {
      const user = ctx.state.user;
      
      if (user && user.role?.name?.toLowerCase() === 'employee') {
        return ctx.forbidden('Accès non autorisé');
      }
      
      const today = DateTime.now();
      const todayStart = today.startOf('day');
      const todayEnd = today.endOf('day');
      
      const attendances = await strapi.db.query('api::attendance.attendance').findMany({
        where: {
          date: {
            $gte: todayStart.toJSDate(),
            $lte: todayEnd.toJSDate()
          }
        },
        populate: ['users_permissions_user']
      });
      
      return {
        data: attendances.map(a => ({
          id: a.id,
          date: a.date,
          check_in: a.check_in,
          check_out: a.check_out,
          work_hours: a.work_hours,
          statuts: a.statuts,
          check_in_late_minutes: a.check_in_late_minutes,
          notes: a.notes || '',
          users_permissions_user: {
            id: a.users_permissions_user,
            username: a.username,
            email: a.email
          }
        }))
      };
      
    } catch (error) {
      console.error('getTodayAttendances error:', error);
      return ctx.internalServerError('Erreur lors de la récupération des présences du jour');
    }
  },
  // ========================= WEEKLY STATS =========================
async getWeeklyStats(ctx: any) {
  try {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const now = DateTime.now();

    const startOfWeek = now.startOf('week');
    const endOfWeek = now.endOf('week');

    const attendances = await strapi.db.query('api::attendance.attendance').findMany({
      where: {
        users_permissions_user: user.id,
        date: {
          $between: [startOfWeek.toJSDate(), endOfWeek.toJSDate()]
        }
      }
    });

    const stats = calculateStats(attendances);

    return {
      data: {
        week: `${startOfWeek.toFormat('dd MMM')} - ${endOfWeek.toFormat('dd MMM yyyy')}`,
        stats
      }
    };

  } catch (e) {
    console.error(e);
    return ctx.badRequest('Erreur weekly stats');
  }
}


}));