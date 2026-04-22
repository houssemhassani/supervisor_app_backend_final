/**
 * attendance router
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/attendances',
      handler: 'attendance.find',
      config: {
        auth: false ,
        policies: []   
      }
    },
    {
      method: 'POST',
      path: '/attendances',
      handler: 'attendance.create',
      config: {
        auth: false,
        policies: []  
      }
    },
    {
      method: 'GET',
      path: '/attendances/export-pdf',
      handler: 'attendance.exportPDF',
      config: {
        auth: false,
        policies: []  
      }
    },
    {
      method: 'PUT',
      path: '/attendances/:id',
      handler: 'attendance.update',
      config: {
        auth: false,
        policies: []  
      }
    },
    {
      method: 'DELETE',
      path: '/attendances/:id',
      handler: 'attendance.delete',
      config: {
        auth: false,
        policies: []  
      }
    },
    {
      method: 'GET',
      path: '/attendances/today',
      handler: 'attendance.getToday',
      config: {
        auth: false,
        policies: []  
      }
    },
    {
      method: 'GET',
      path: '/attendances/weekly-stats',
      handler: 'attendance.getWeeklyStats',
      config: {
        auth: false,
        policies: []  
      }
    },
    {
      method: 'GET',
      path: '/attendances/stats',
      handler: 'attendance.getMonthlyStats',
      config: {
        auth: false,
        policies: []  
      }
    },
    {
      method: 'POST',
      path: '/attendances/check-in',
      handler: 'attendance.checkIn',
      config: {
        auth: false,
        policies: []  
      }
    },
    {
      method: 'PUT',
      path: '/attendances/check-out',
      handler: 'attendance.checkOut',
      config: {
        auth: false,
        policies: []  
      }
    }
  ]
};