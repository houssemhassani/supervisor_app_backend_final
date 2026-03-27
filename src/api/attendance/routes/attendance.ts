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
        auth: false/*  {
          scope: ['employee', 'manager', 'admin']
        } */
      }
    },
    {
      method: 'POST',
      path: '/attendances',
      handler: 'attendance.create',
      config: {
        auth: false/*  {
          scope: ['manager', 'admin']
        } */
      }
    },
    {
      method: 'PUT',
      path: '/attendances/:id',
      handler: 'attendance.update',
      config: {
        auth:false /* {
          scope: ['manager', 'admin']
        } */
      }
    },
    {
      method: 'DELETE',
      path: '/attendances/:id',
      handler: 'attendance.delete',
      config: {
        auth: false /* {
          scope: ['manager', 'admin']
        } */
      }
    },
    {
      method: 'GET',
      path: '/attendances/today',
      handler: 'attendance.getToday',
      config: {
        auth:  false /*  {
          scope: ['employee', 'manager', 'admin']
        } */
      }
    },
    {
      method: 'GET',
      path: '/attendances/weekly-stats',
      handler: 'attendance.getWeeklyStats',
      config: {
        auth: false/* {
          scope: ['employee', 'manager', 'admin']
        } */
      }
    },
    {
      method: 'POST',
      path: '/attendances/check-in',
      handler: 'attendance.checkIn',
      config: {
        auth: false/* {
          scope: ['employee', 'manager', 'admin']
        } */
      }
    },
    {
      method: 'PUT',
      path: '/attendances/check-out',
      handler: 'attendance.checkOut',
      config: {
        auth: false /*  {
          scope: ['employee', 'manager', 'admin']
        } */
      }
    }
  ]
};