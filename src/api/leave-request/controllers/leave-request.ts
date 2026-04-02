import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::leave-request.leave-request', ({ strapi }) => ({
  
  /**
   * Récupérer les demandes de congé selon le rôle
   * GET /api/leave-requests
   */
  async find(ctx) {
    try {
      const user = ctx.state.user;
      
      if (!user) {
        console.log('❌ [LeaveRequest find] Utilisateur non authentifié');
        return ctx.unauthorized('Vous devez être connecté pour accéder à vos demandes de congé');
      }
      
      console.log('✅ [LeaveRequest find] Utilisateur:', user.id, 'Email:', user.email, 'Rôle:', user.role?.name);
      
      const userRole = user.role?.name?.toLowerCase();
      
      // Si c'est un employee, filtrer ses propres demandes
      if (userRole === 'employee') {
        // CORRECTION: S'assurer que filters est un objet valide
        const existingFilters = ctx.query?.filters && typeof ctx.query.filters === 'object' 
          ? ctx.query.filters 
          : {};
        
        // Créer un nouvel objet filters
        const newFilters = {
          ...existingFilters,
          user: { id: user.id }
        };
        
        // Initialiser ctx.query si nécessaire
        if (!ctx.query) {
          ctx.query = {};
        }
        
        ctx.query.filters = newFilters;
        
        console.log('🔍 [LeaveRequest find] Filtre employee:', JSON.stringify(ctx.query.filters));
      } else {
        console.log('👑 [LeaveRequest find] Accès manager/admin - toutes les demandes');
      }
      
      // Appeler le contrôleur parent avec les filtres modifiés
      const { data, meta } = await super.find(ctx);
      
      console.log(`📊 [LeaveRequest find] ${data?.length || 0} demandes trouvées`);
      
      return { data, meta };
      
    } catch (error) {
      console.error('❌ [LeaveRequest find] Erreur:', error);
      return ctx.internalServerError('Erreur lors de la récupération des demandes de congé');
    }
  },
  
  /**
   * Récupérer une demande de congé spécifique
   * GET /api/leave-requests/:id
   */
  async findOne(ctx) {
    try {
      const user = ctx.state.user;
      const { id } = ctx.params;
      
      if (!user) {
        return ctx.unauthorized('Vous devez être connecté');
      }
      
      console.log(`🔍 [LeaveRequest findOne] ID: ${id}, Utilisateur: ${user.id}`);
      
      // Récupérer la demande
      const leaveRequest = await strapi.db.query('api::leave-request.leave-request').findOne({
        where: { id },
        populate: { user: true }
      });
      
      if (!leaveRequest) {
        return ctx.notFound('Demande de congé non trouvée');
      }
      
      const userRole = user.role?.name?.toLowerCase();
      
      // Vérifier les droits d'accès
      if (userRole === 'employee' && leaveRequest.user.id !== user.id) {
        console.warn(`⚠️ [LeaveRequest findOne] Tentative d'accès non autorisé: utilisateur ${user.id} tente d'accéder à la demande ${id} de l'utilisateur ${leaveRequest.user.id}`);
        return ctx.forbidden('Vous n\'avez pas le droit d\'accéder à cette demande');
      }
      
      // Appeler le contrôleur parent
      const { data, meta } = await super.findOne(ctx);
      return { data, meta };
      
    } catch (error) {
      console.error('❌ [LeaveRequest findOne] Erreur:', error);
      return ctx.internalServerError('Erreur lors de la récupération de la demande');
    }
  },
  
  /**
   * Créer une demande de congé
   * POST /api/leave-requests
   */
async create(ctx) {
  console.log('========== DÉBUT REQUÊTE CREATE ==========');
  console.log('Body reçu:', JSON.stringify(ctx.request.body, null, 2));
  
  try {
    // Récupérer les données du frontend
    const requestData = ctx.request.body.data;
    
    if (!requestData) {
      return ctx.badRequest('Données de demande de congé manquantes');
    }
    
    // Valider les champs requis
    const requiredFields = ['type', 'start_date', 'end_date', 'reason'];
    const missingFields = requiredFields.filter(field => !requestData[field]);
    
    if (missingFields.length > 0) {
      return ctx.badRequest(`Champs manquants: ${missingFields.join(', ')}`);
    }
    
    // Récupérer l'user ID envoyé par le frontend
    const userId = requestData.userId;
    
    if (!userId) {
      console.error('❌ Aucun userId reçu du frontend');
      return ctx.badRequest('Utilisateur non spécifié');
    }
    
    console.log('👤 UserId reçu du frontend:', userId);
    
    // Vérifier que l'utilisateur existe dans la base
    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: parseInt(userId) }
    });
    
    if (!user) {
      console.error('❌ Utilisateur non trouvé avec ID:', userId);
      return ctx.badRequest('Utilisateur non trouvé');
    }
    
    console.log('✅ Utilisateur trouvé:', {
      id: user.id,
      email: user.email,
      username: user.username
    });
    
    // Vérifier les dates
    const startDate = new Date(requestData.start_date);
    const endDate = new Date(requestData.end_date);
    
    if (startDate > endDate) {
      return ctx.badRequest('La date de début doit être antérieure à la date de fin');
    }
    
    // Calculer la durée
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    // CRÉATION AVEC LE USER ID
    const result = await strapi.db.query('api::leave-request.leave-request').create({
      data: {
        type: requestData.type,
        start_date: requestData.start_date,
        end_date: requestData.end_date,
        reason: requestData.reason,
        statuts: 'PENDING',
        user: user.id,
        duration_days: diffDays,
        publishedAt: new Date()
      }
    });
    
    console.log('✅ Demande créée avec succès');
    console.log('📊 ID de la demande:', result.id);
    console.log('👤 User associé (result.user):', result.user);
    
    // 🔥 RÉCUPÉRER LA DEMANDE AVEC LES RELATIONS POUR CONFIRMER
    const createdRequest = await strapi.db.query('api::leave-request.leave-request').findOne({
      where: { id: result.id },
      populate: ['user']
    });
    
    console.log('📊 Demande complète avec relations:', JSON.stringify(createdRequest, null, 2));
    
    // 🔥 RETOURNER LA DEMANDE AVEC LES INFOS USER
    return ctx.send({
      success: true,
      message: 'Demande de congé créée avec succès',
      data: {
        id: createdRequest.id,
        type: createdRequest.type,
        start_date: createdRequest.start_date,
        end_date: createdRequest.end_date,
        reason: createdRequest.reason,
        statuts: createdRequest.statuts,
        duration_days: createdRequest.duration_days,
        user: createdRequest.user?.id || createdRequest.user,  // ← Forcer l'affichage du user
        createdAt: createdRequest.createdAt,
        updatedAt: createdRequest.updatedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    return ctx.internalServerError(error.message);
  }
},
  
  /**
   * Mettre à jour une demande de congé
   * PUT /api/leave-requests/:id
   */
  /**
 * Mettre à jour une demande de congé
 * PUT /api/leave-requests/:id
 */
async update(ctx) {
  try {
    const user = ctx.state.user;
    const { id } = ctx.params;
    
    console.log(`✏️ [LeaveRequest update] ID: ${id}`);
    console.log('📦 Données reçues:', ctx.request.body);
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    // Récupérer la demande existante
    const existingLeaveRequest = await strapi.db.query('api::leave-request.leave-request').findOne({
      where: { id: parseInt(id) },
      populate: { user: true }
    });
    
    if (!existingLeaveRequest) {
      return ctx.notFound('Demande de congé non trouvée');
    }
    
    const userRole = user.role?.name?.toLowerCase();
    
    // Vérifier les permissions
    if (userRole === 'employee') {
      // Un employee ne peut modifier que ses propres demandes
      if (existingLeaveRequest.user.id !== user.id) {
        return ctx.forbidden('Vous ne pouvez pas modifier cette demande');
      }
      
      // Un employee ne peut modifier que les demandes en attente
      if (existingLeaveRequest.statuts !== 'PENDING') {
        return ctx.badRequest('Seules les demandes en attente peuvent être modifiées');
      }
    }
    
    // Récupérer les données de mise à jour
    const requestData = ctx.request.body.data;
    
    if (!requestData) {
      return ctx.badRequest('Données de modification manquantes');
    }
    
    // Préparer les données de mise à jour
    const updateData: any = {};
    
    if (requestData.type) updateData.type = requestData.type;
    if (requestData.start_date) updateData.start_date = requestData.start_date;
    if (requestData.end_date) updateData.end_date = requestData.end_date;
    if (requestData.reason) updateData.reason = requestData.reason;
    
    // Si les dates changent, recalculer la durée
    if (requestData.start_date && requestData.end_date) {
      const startDate = new Date(requestData.start_date);
      const endDate = new Date(requestData.end_date);
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      updateData.duration_days = diffDays;
    }
    
    updateData.updated_by = user.id;
    
    console.log('📝 Mise à jour avec:', updateData);
    
    // Mettre à jour la demande
    const result = await strapi.db.query('api::leave-request.leave-request').update({
      where: { id: parseInt(id) },
      data: updateData
    });
    
    console.log(`✅ Demande ${id} mise à jour avec succès`);
    
    return ctx.send({
      success: true,
      message: 'Demande modifiée avec succès',
      data: result
    });
    
  } catch (error) {
    console.error('❌ [LeaveRequest update] Erreur:', error);
    return ctx.internalServerError(`Erreur lors de la mise à jour: ${error.message}`);
  }
},
  
  /**
   * Supprimer une demande de congé
   * DELETE /api/leave-requests/:id
   */
  async delete(ctx) {
  try {
    const user = ctx.state.user;
    const { id } = ctx.params;
    
    if (!user) {
      return ctx.unauthorized('Vous devez être connecté');
    }
    
    // Récupérer la demande avant suppression
    const existingLeaveRequest = await strapi.db.query('api::leave-request.leave-request').findOne({
      where: { id: parseInt(id) },
      populate: { user: true }
    });
    
    if (!existingLeaveRequest) {
      return ctx.notFound('Demande non trouvée');
    }
    
    // Vérifier les permissions
    const userRole = user.role?.name?.toLowerCase();
    if (userRole === 'employee') {
      if (existingLeaveRequest.user.id !== user.id) {
        return ctx.forbidden('Vous ne pouvez pas supprimer cette demande');
      }
      if (existingLeaveRequest.statuts !== 'PENDING') {
        return ctx.badRequest('Seules les demandes en attente peuvent être supprimées');
      }
    }
    
    // Supprimer
    await strapi.db.query('api::leave-request.leave-request').delete({
      where: { id: parseInt(id) }
    });
    
    console.log(`✅ Demande ${id} supprimée`);
    
    // Retourner l'objet supprimé
    return ctx.send({
      success: true,
      message: 'Demande supprimée avec succès',
      data: existingLeaveRequest  // ← Retourner les données supprimées
    });
    
  } catch (error) {
    console.error('❌ Erreur suppression:', error);
    return ctx.internalServerError(error.message);
  }
},
  
  /**
   * Approuver une demande de congé (Manager/Admin uniquement)
   * POST /api/leave-requests/:id/approve
   */
  async approve(ctx) {
    try {
      const user = ctx.state.user;
      const { id } = ctx.params;
      const { comments } = ctx.request.body;
      
      if (!user) {
        return ctx.unauthorized('Vous devez être connecté');
      }
      
      console.log(`✅ [LeaveRequest approve] ID: ${id}, Par: ${user.id} (${user.email})`);
      
      const userRole = user.role?.name?.toLowerCase();
      
      // Vérifier que l'utilisateur a les droits (manager ou admin)
      if (userRole !== 'manager' && userRole !== 'admin') {
        console.warn(`⚠️ [LeaveRequest approve] Tentative non autorisée par ${user.role?.name}`);
        return ctx.forbidden('Vous n\'avez pas les droits pour approuver une demande de congé');
      }
      
      // Récupérer la demande existante
      const existingLeaveRequest = await strapi.db.query('api::leave-request.leave-request').findOne({
        where: { id }
      });
      
      if (!existingLeaveRequest) {
        return ctx.notFound('Demande de congé non trouvée');
      }
      
      // Vérifier que la demande est en attente
      if (existingLeaveRequest.statuts !== 'PENDING') {
        return ctx.badRequest('Cette demande a déjà été traitée');
      }
      
      const now = new Date();
      
      // Mettre à jour la demande
      const updatedRequest = await strapi.db.query('api::leave-request.leave-request').update({
        where: { id },
        data: {
          statuts: 'APPROVED',
          approved_by: user.id,
          manager_comments: comments || null,
          approval_date: now,
          updated_by: user.id
        }
      });
      
      console.log(`✅ [LeaveRequest approve] Demande ${id} approuvée par ${user.email}`);
      
      return ctx.send({
        success: true,
        message: 'Demande de congé approuvée avec succès',
        data: updatedRequest
      });
      
    } catch (error) {
      console.error('❌ [LeaveRequest approve] Erreur:', error);
      return ctx.internalServerError('Erreur lors de l\'approbation de la demande');
    }
  },
  
  /**
   * Rejeter une demande de congé (Manager/Admin uniquement)
   * POST /api/leave-requests/:id/reject
   */
  async reject(ctx) {
    try {
      const user = ctx.state.user;
      const { id } = ctx.params;
      const { comments } = ctx.request.body;
      
      if (!user) {
        return ctx.unauthorized('Vous devez être connecté');
      }
      
      console.log(`❌ [LeaveRequest reject] ID: ${id}, Par: ${user.id} (${user.email})`);
      
      const userRole = user.role?.name?.toLowerCase();
      
      // Vérifier que l'utilisateur a les droits (manager ou admin)
      if (userRole !== 'manager' && userRole !== 'admin') {
        console.warn(`⚠️ [LeaveRequest reject] Tentative non autorisée par ${user.role?.name}`);
        return ctx.forbidden('Vous n\'avez pas les droits pour rejeter une demande de congé');
      }
      
      // Récupérer la demande existante
      const existingLeaveRequest = await strapi.db.query('api::leave-request.leave-request').findOne({
        where: { id }
      });
      
      if (!existingLeaveRequest) {
        return ctx.notFound('Demande de congé non trouvée');
      }
      
      // Vérifier que la demande est en attente
      if (existingLeaveRequest.statuts !== 'PENDING') {
        return ctx.badRequest('Cette demande a déjà été traitée');
      }
      
      const now = new Date();
      
      // Mettre à jour la demande
      const updatedRequest = await strapi.db.query('api::leave-request.leave-request').update({
        where: { id },
        data: {
          statuts: 'REJECTED',
          approved_by: user.id,
          manager_comments: comments || null,
          approval_date: now,
          updated_by: user.id
        }
      });
      
      console.log(`❌ [LeaveRequest reject] Demande ${id} rejetée par ${user.email}`);
      
      return ctx.send({
        success: true,
        message: 'Demande de congé rejetée',
        data: updatedRequest
      });
      
    } catch (error) {
      console.error('❌ [LeaveRequest reject] Erreur:', error);
      return ctx.internalServerError('Erreur lors du rejet de la demande');
    }
  },
  
  /**
   * Obtenir les statistiques des congés pour un employé
   * GET /api/leave-requests/stats
   */
  async getStats(ctx) {
    try {
      const user = ctx.state.user;
      
      if (!user) {
        return ctx.unauthorized('Vous devez être connecté');
      }
      
      console.log(`📊 [LeaveRequest getStats] Utilisateur: ${user.id}`);
      
      const userRole = user.role?.name?.toLowerCase();
      let userId = user.id;
      
      // Si c'est un manager/admin et qu'un userId est spécifié, on peut voir les stats d'un autre employé
      if ((userRole === 'manager' || userRole === 'admin') && ctx.query.userId) {
        userId = parseInt(ctx.query.userId as string);
        console.log(`👑 [LeaveRequest getStats] Accès manager - stats pour userId: ${userId}`);
      }
      
      // Récupérer toutes les demandes de l'utilisateur
      const leaveRequests = await strapi.db.query('api::leave-request.leave-request').findMany({
        where: { user: userId },
        select: ['id', 'type', 'statuts', 'start_date', 'end_date']
      });
      
      // Calculer les statistiques
      const stats = {
        total: leaveRequests.length,
        pending: leaveRequests.filter(r => r.statuts === 'PENDING').length,
        approved: leaveRequests.filter(r => r.statuts === 'APPROVED').length,
        rejected: leaveRequests.filter(r => r.statuts === 'REJECTED').length,
        cancelled: leaveRequests.filter(r => r.statuts === 'CANCELLED').length,
        byType: {
          ANNUAL: leaveRequests.filter(r => r.type === 'ANNUAL').length,
          SICK: leaveRequests.filter(r => r.type === 'SICK').length,
          UNPAID: leaveRequests.filter(r => r.type === 'UNPAID').length,
          OTHER: leaveRequests.filter(r => r.type === 'OTHER').length
        },
        totalDaysApproved: 0
      };
      
      // Calculer le total de jours approuvés
      const approvedRequests = leaveRequests.filter(r => r.statuts === 'APPROVED');
      for (const request of approvedRequests) {
        const start = new Date(request.start_date);
        const end = new Date(request.end_date);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
        stats.totalDaysApproved += days;
      }
      
      console.log(`✅ [LeaveRequest getStats] Stats calculées: total=${stats.total}, approuvées=${stats.approved}`);
      
      return ctx.send({
        success: true,
        data: stats
      });
      
    } catch (error) {
      console.error('❌ [LeaveRequest getStats] Erreur:', error);
      return ctx.internalServerError('Erreur lors du calcul des statistiques');
    }
  },
  async test(ctx) {
    console.log('========== ROUTE TEST ==========');
    console.log('✅ Route test atteinte !');
    console.log('Method:', ctx.request.method);
    console.log('URL:', ctx.request.url);
    console.log('Headers:', ctx.request.headers);
    console.log('================================');
    
    return ctx.send({
      success: true,
      message: 'Route test fonctionne !',
      timestamp: new Date().toISOString(),
      method: ctx.request.method,
      url: ctx.request.url
    });
  }
}));