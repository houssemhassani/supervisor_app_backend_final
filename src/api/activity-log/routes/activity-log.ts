// src/api/activity-log/routes/activity-log.ts

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::activity-log.activity-log', {
  config: {
    find: {
      policies: [],
      middlewares: []
    },
    create: {
      policies: [],
      middlewares: []
    }
  }
});

// Ajouter la route custom séparément
export const routes = [
  {
    method: 'GET',
    path: '/activity-logs/today-stats',
    handler: 'activity-log.getTodayStats',
    config: {
      policies: [],
      middlewares: []
    }
  }
];