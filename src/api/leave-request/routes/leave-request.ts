/**
 * leave-request router
 */

import { factories } from '@strapi/strapi';

export default {
  routes: [
    {
      method: 'GET',
      path: '/leave-requests',
      handler: 'leave-request.find',
      config: {
        auth:false
      }
    },
    {
      method: 'POST',
      path: '/leave-requests',
      handler: 'leave-request.create',
      config: {
        auth: false
      }
    },
    {
      method: 'PUT',
      path: '/leave-requests/:id',
      handler: 'leave-request.update',
      config: {
        auth: false
      }
    },
    {
      method: 'DELETE',
      path: '/leave-requests/:id',
      handler: 'leave-request.delete',
      config: {
        auth:false
      }
    },
    {
      method: 'POST',
      path: '/leave-requests/:id/approve',
      handler: 'leave-request.approve',
      config: {
        auth:false
      }
    },
    {
      method: 'POST',
      path: '/leave-requests/:id/reject',
      handler: 'leave-request.reject',
      config: {
        auth:false
      }
    }
  ]
};