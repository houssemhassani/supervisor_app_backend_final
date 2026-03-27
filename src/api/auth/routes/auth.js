// src/api/auth/routes/auth.js

'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/auth/send-reset-code',
      handler: 'auth.sendResetCode',
      config: {
        policies: [],
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/auth/reset-password-custom',
      handler: 'auth.resetPassword',
      config: {
        policies: [],
        auth: false,
      },
    },
  ],
};