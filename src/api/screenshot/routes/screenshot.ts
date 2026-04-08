export default {
  routes: [
    {
      method: 'GET',
      path: '/screenshots',
      handler: 'screenshot.find',
      config: { 
        policies: [],
        auth: { scope: ['api::screenshot.screenshot.find'] }
      }
    },
    {
      method: 'GET',
      path: '/screenshots/:id',
      handler: 'screenshot.findOne',
      config: { 
        policies: [],
        auth: { scope: ['api::screenshot.screenshot.findOne'] }
      }
    },
    {
      method: 'POST',
      path: '/screenshots',
      handler: 'screenshot.create',
      config: { 
        policies: [],
        auth: { scope: ['api::screenshot.screenshot.create'] }
      }
    },
    {
      method: 'PUT',
      path: '/screenshots/:id',
      handler: 'screenshot.update',
      config: { 
        policies: [],
        auth: { scope: ['api::screenshot.screenshot.update'] }
      }
    },
    {
      method: 'DELETE',
      path: '/screenshots/:id',
      handler: 'screenshot.delete',
      config: { 
        policies: [],
        auth: { scope: ['api::screenshot.screenshot.delete'] }
      }
    },
    {
      method: 'POST',
      path: '/screenshots/capture-and-compare',
      handler: 'screenshot.captureAndCompare',
      config: { 
        policies: [],
        auth: { scope: ['api::screenshot.screenshot.captureAndCompare'] }
      }
    },
    {
      method: 'GET',
      path: '/screenshots/today',
      handler: 'screenshot.getTodayScreenshots',
      config: { 
        policies: [],
        auth: { scope: ['api::screenshot.screenshot.getTodayScreenshots'] }
      }
    },
    // 🔥 NOUVELLE ROUTE POUR LE MODULE IA
    {
      method: 'GET',
      path: '/screenshots/ai/export-data',
      handler: 'screenshot.exportForAI',
      config: { 
        policies: [],
        auth: false /* { scope: ['api::screenshot.screenshot.exportForAI'] } */
      }
    }
  ]
};