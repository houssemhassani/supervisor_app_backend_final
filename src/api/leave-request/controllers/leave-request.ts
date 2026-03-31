// src/api/leave-request/controllers/leave-request.ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::leave-request.leave-request', ({ strapi }) => ({
  /**
   * Récupérer les demandes de congé selon le rôle
   */
  async find(ctx) {
    // Récupérer l'utilisateur depuis le token manuellement
    let user = ctx.state.user;
    
    if (!user) {
      const authHeader = ctx.request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
          user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: decoded.id }
          });
        } catch (error) {
          console.log('Token invalide ou expiré');
        }
      }
    }
    
    // Si toujours pas d'utilisateur, retourner une liste vide
    if (!user) {
      console.log('📋 [LeaveRequest find] Aucun utilisateur trouvé');
      return ctx.send({ data: [] });
    }
    
    console.log('📋 [LeaveRequest find] Utilisateur:', user.id);
    const userRole = user.role?.name?.toLowerCase();
    
    // Si c'est un employee, filtrer ses propres demandes
    if (userRole === 'employee') {
      const existingFilters = ctx.query?.filters || {};
      
      const newFilters: any = {
        user: { id: user.id }
      };
      
      if (existingFilters && typeof existingFilters === 'object') {
        Object.keys(existingFilters).forEach(key => {
          newFilters[key] = (existingFilters as any)[key];
        });
      }
      
      if (!ctx.query) {
        ctx.query = {};
      }
      ctx.query.filters = newFilters;
    }
    
    const { data, meta } = await super.find(ctx);
    return { data, meta };
  },
  
  /**
   * Créer une demande de congé
   */
async create(ctx) {
  const user = ctx.state.user;
  if (!user) return ctx.unauthorized("Utilisateur non connecté");

  const requestData = ctx.request.body.data;

  const newData = {
    ...requestData,
    user: user.id,
    created_by: user.id,  // Remplit created_by_id automatiquement
    statuts: 'PENDING'
  };

  ctx.request.body = { data: newData };
  return await super.create(ctx);
},
  
  /**
   * Mettre à jour une demande de congé
   */
  async update(ctx) {
    // Récupérer l'utilisateur manuellement
    let user = ctx.state.user;
    
    if (!user) {
      const authHeader = ctx.request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
          user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: decoded.id }
          });
        } catch (error) {
          console.log('Token invalide ou expiré');
        }
      }
    }
    
    const { id } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Récupérer la demande
    const leaveRequest = await strapi.db.query('api::leave-request.leave-request').findOne({
      where: { id },
      populate: { user: true }
    });
    
    if (!leaveRequest) {
      return ctx.notFound('Demande non trouvée');
    }
    
    // Vérifier les permissions
    if (userRole === 'employee') {
      if (leaveRequest.user.id !== user.id) {
        return ctx.forbidden('Vous ne pouvez pas modifier cette demande');
      }
      if (leaveRequest.statuts !== 'PENDING') {
        return ctx.badRequest('Seules les demandes en attente peuvent être modifiées');
      }
    }
    
    const response = await super.update(ctx);
    return response;
  },
  
  /**
   * Supprimer une demande de congé
   */
  async delete(ctx) {
    // Récupérer l'utilisateur manuellement
    let user = ctx.state.user;
    
    if (!user) {
      const authHeader = ctx.request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
          user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: decoded.id }
          });
        } catch (error) {
          console.log('Token invalide ou expiré');
        }
      }
    }
    
    const { id } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Récupérer la demande
    const leaveRequest = await strapi.db.query('api::leave-request.leave-request').findOne({
      where: { id },
      populate: { user: true }
    });
    
    if (!leaveRequest) {
      return ctx.notFound('Demande non trouvée');
    }
    
    // Vérifier les permissions
    if (userRole === 'employee') {
      if (leaveRequest.user.id !== user.id) {
        return ctx.forbidden('Vous ne pouvez pas supprimer cette demande');
      }
      if (leaveRequest.statuts !== 'PENDING') {
        return ctx.badRequest('Seules les demandes en attente peuvent être supprimées');
      }
    }
    
    const response = await super.delete(ctx);
    return response;
  },
  
  /**
   * Approuver une demande de congé (Manager/Admin uniquement)
   */
  async approve(ctx) {
    let user = ctx.state.user;
    
    if (!user) {
      const authHeader = ctx.request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
          user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: decoded.id }
          });
        } catch (error) {
          console.log('Token invalide ou expiré');
        }
      }
    }
    
    const { id } = ctx.params;
    const { comments } = ctx.request.body;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    if (userRole !== 'manager' && userRole !== 'admin') {
      return ctx.forbidden('Vous n\'avez pas les droits pour approuver une demande');
    }
    
    const now = new Date();
    
    const response = await strapi.db.query('api::leave-request.leave-request').update({
      where: { id },
      data: {
        statuts: 'APPROVED',
        approved_by: user.id,
        manager_comments: comments || null,
        approval_date: now
      }
    });
    
    return ctx.send({
      success: true,
      message: 'Demande approuvée',
      data: response
    });
  },
  
  /**
   * Rejeter une demande de congé (Manager/Admin uniquement)
   */
  async reject(ctx) {
    let user = ctx.state.user;
    
    if (!user) {
      const authHeader = ctx.request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my-secret-key');
          user = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { id: decoded.id }
          });
        } catch (error) {
          console.log('Token invalide ou expiré');
        }
      }
    }
    
    const { id } = ctx.params;
    const { comments } = ctx.request.body;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    if (userRole !== 'manager' && userRole !== 'admin') {
      return ctx.forbidden('Vous n\'avez pas les droits pour rejeter une demande');
    }
    
    const now = new Date();
    
    const response = await strapi.db.query('api::leave-request.leave-request').update({
      where: { id },
      data: {
        statuts: 'REJECTED',
        approved_by: user.id,
        manager_comments: comments || null,
        approval_date: now
      }
    });
    
    return ctx.send({
      success: true,
      message: 'Demande rejetée',
      data: response
    });
  }
}));