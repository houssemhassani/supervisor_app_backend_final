/**
 * leave-request controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::leave-request.leave-request', ({ strapi }) => ({
  /**
   * Récupérer les demandes de congé selon le rôle
   */
  async find(ctx) {
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Si c'est un employee, filtrer ses propres demandes
    if (userRole === 'employee') {
      // Initialiser les filtres de manière simple
      const existingFilters = ctx.query?.filters || {};
      
      // Créer un nouvel objet filters
      const newFilters: any = {
        user: { id: user.id }
      };
      
      // Copier les filtres existants
      if (existingFilters && typeof existingFilters === 'object') {
        Object.keys(existingFilters).forEach(key => {
          newFilters[key] = (existingFilters as any)[key];
        });
      }
      
      // Appliquer les filtres
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
    const { user } = ctx.state;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    const requestData = ctx.request.body?.data || {};
    
    // Construire les données
    const createData: any = {};
    
    // Copier les données existantes
    if (requestData && typeof requestData === 'object') {
      Object.keys(requestData).forEach(key => {
        createData[key] = requestData[key];
      });
    }
    
    // Si c'est un employee, forcer l'utilisateur à lui-même
    if (userRole === 'employee') {
      createData.user = user.id;
      createData.statuts = 'PENDING';
    }
    
    // Calculer la durée en jours
    if (requestData.start_date && requestData.end_date) {
      const start = new Date(requestData.start_date);
      const end = new Date(requestData.end_date);
      const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      createData.duration_days = durationDays;
    }
    
    ctx.request.body = { data: createData };
    
    const response = await super.create(ctx);
    return response;
  },
  
  /**
   * Mettre à jour une demande de congé
   */
  async update(ctx) {
    const { user } = ctx.state;
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
    const { user } = ctx.state;
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
    const { user } = ctx.state;
    const { id } = ctx.params;
    const { comments } = ctx.request.body;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Seul manager ou admin peut approuver
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
    const { user } = ctx.state;
    const { id } = ctx.params;
    const { comments } = ctx.request.body;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Seul manager ou admin peut rejeter
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