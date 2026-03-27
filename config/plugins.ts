// config/plugins.js
module.exports = ({ env }) => ({
  'users-permissions': {
    config: {
      jwtSecret: env('JWT_SECRET') || 'my-super-secret-key-change-this-in-production',
      jwt: {
        expiresIn: '7d',
      },
    },
  },
});