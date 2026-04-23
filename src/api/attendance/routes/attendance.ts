/**
 * attendance router
 */

export default {
  routes: [

    // ===== CRUD =====
    {
      method: 'GET',
      path: '/attendances',
      handler: 'attendance.find',
      config: { auth: false }
    },
    {
      method: 'GET',
      path: '/attendances/employee/:employeeId',
      handler: 'attendance.findByEmployee',
      config: {
        auth: false
      }
    },
    {
      method: 'GET',
      path: '/attendances/employee/:employeeId/month',
      handler: 'attendance.findByEmployeeMonth',
      config: {
        auth: false
      }
    },
    {
      method: 'POST',
      path: '/attendances',
      handler: 'attendance.create',
      config: { auth: false }
    },
    {
      method: 'PUT',
      path: '/attendances/:id',
      handler: 'attendance.update',
      config: { auth: false }
    },
    {
      method: 'DELETE',
      path: '/attendances/:id',
      handler: 'attendance.delete',
      config: { auth: false }
    },

    // ===== ACTIONS =====
    {
      method: 'POST',
      path: '/attendances/check-in',
      handler: 'attendance.checkIn',
      config: { auth: false }
    },
    {
      method: 'POST', // ✅ corrigé (au lieu de PUT)
      path: '/attendances/check-out',
      handler: 'attendance.checkOut',
      config: { auth: false }
    },

    // ===== DATA =====
    {
      method: 'GET',
      path: '/attendances/today',
      handler: 'attendance.getToday',
      config: { auth: false }
    },
    {
      method: 'GET',
      path: '/attendances/weekly-stats',
      handler: 'attendance.getWeeklyStats',
      config: { auth: false }
    },
    {
      method: 'GET',
      path: '/attendances/stats',
      handler: 'attendance.getMonthlyStats',
      config: { auth: false }
    },

    // ===== EXPORT =====
    {
      method: 'GET',
      path: '/attendances/export-pdf',
      handler: 'attendance.exportPDF',
      config: { auth: false }
    }

  ]
};