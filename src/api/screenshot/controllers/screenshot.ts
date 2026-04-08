import { factories } from '@strapi/strapi';
import * as fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

// Helper: Upload d'image
async function uploadImage(strapi: any, filePath: string, fileName: string, buffer: Buffer, refId: number) {
  try {
    const file = await strapi.plugins.upload.services.upload.upload({
      data: {
        fileInfo: {
          name: fileName,
          caption: `Screenshot ${new Date().toISOString()}`,
          alternativeText: `Screenshot captured at ${new Date().toISOString()}`
        },
        ref: 'api::screenshot.screenshot',
        refId: refId,
        field: 'image'
      },
      files: {
        path: filePath,
        name: fileName,
        type: 'image/png',
        size: buffer.length
      }
    });
    return file;
  } catch (error) {
    console.error('Erreur upload:', error);
    return null;
  }
}

// Helper: Calculer un hash simple du fichier
function computeHash(buffer: Buffer): string {
  let hash = 0;
  for (let i = 0; i < buffer.length; i++) {
    hash = ((hash << 5) - hash) + buffer[i];
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// Helper: Comparer deux images
async function compareImages(imagePath1: string, imagePath2: string): Promise<number> {
  console.log('🔍 [COMPARE] Début comparaison');
  console.log('🔍 Image 1:', imagePath1);
  console.log('🔍 Image 2:', imagePath2);
  
  if (!fs.existsSync(imagePath1)) {
    console.error('❌ Image 1 n\'existe pas:', imagePath1);
    return 0;
  }
  if (!fs.existsSync(imagePath2)) {
    console.error('❌ Image 2 n\'existe pas:', imagePath2);
    return 0;
  }
  
  try {
    const img1 = PNG.sync.read(fs.readFileSync(imagePath1));
    const img2 = PNG.sync.read(fs.readFileSync(imagePath2));
    
    console.log('📐 Dimensions image 1:', img1.width, 'x', img1.height);
    console.log('📐 Dimensions image 2:', img2.width, 'x', img2.height);
    
    if (img1.width !== img2.width || img1.height !== img2.height) {
      console.log('⚠️ Tailles différentes, impossible de comparer');
      return 0;
    }
    
    const diff = new PNG({ width: img1.width, height: img1.height });
    const numDiffPixels = pixelmatch(
      img1.data,
      img2.data,
      diff.data,
      img1.width,
      img1.height,
      { threshold: 0.1 }
    );
    
    const totalPixels = img1.width * img1.height;
    const similarity = ((totalPixels - numDiffPixels) / totalPixels) * 100;
    
    console.log(`📊 Résultat: ${similarity.toFixed(2)}% similaire (${numDiffPixels} pixels différents)`);
    
    return Math.round(similarity);
  } catch (error) {
    console.error('❌ Erreur comparaison:', error);
    return 0;
  }
}

export default factories.createCoreController('api::screenshot.screenshot', ({ strapi }) => ({
  
  // Capturer et comparer binisba la5er capture
  async captureAndCompare(ctx: any) {
    try {
      console.log('🔵 [captureAndCompare] Début');
      console.log('🔵 Headers:', ctx.request.headers.authorization ? 'Token présent' : 'Token manquant');
      
      const { user } = ctx.state;
      const { imageData, projectId } = ctx.request.body;
      
      console.log('🔵 User:', user ? user.id : 'Non authentifié');
      
      if (!user) {
        console.error('❌ Utilisateur non authentifié');
        return ctx.unauthorized('Non authentifié');
      }
      
      if (!imageData) {
        console.error('❌ Pas de données image');
        return ctx.badRequest('Image data manquante');
      }
      
      // 1. Sauvegarder capture ejdida temporairement
      const buffer = Buffer.from(imageData.split(',')[1], 'base64');
      const fileName = `screenshot_${user.id}_${Date.now()}.png`;
      const tempDir = './tmp/screenshots';
      
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFilePath = path.join(tempDir, fileName);
      fs.writeFileSync(tempFilePath, buffer);
      console.log(`📸 Fichier temporaire créé: ${tempFilePath}`);
      console.log(`📸 Taille du fichier: ${buffer.length} bytes`);
      
      // 2. Récupérer a5er capture
      let lastScreenshot = null;
      try {
        lastScreenshot = await strapi.db.query('api::screenshot.screenshot').findMany({
          where: { 
            user: { id: user.id },
            publishedAt: { $notNull: true }
          },
          orderBy: { captured_at: 'desc' },
          limit: 1,
          populate: ['image']
        });
        console.log(`📸 Dernière capture trouvée: ${lastScreenshot && lastScreenshot.length > 0 ? 'Oui (ID: ' + lastScreenshot[0]?.id + ')' : 'Non'}`);
      } catch (err) {
        console.error('Erreur récupération dernière capture:', err);
      }
      
      let isIdentical = false;
      let similarity = 0;
      
      // 3. Comparer avec la dernière capture si elle existe
      if (lastScreenshot && lastScreenshot.length > 0) {
        const last: any = lastScreenshot[0];
        
        console.log('🔍 Vérification de l\'image existante...');
        console.log('🔍 last.image:', last.image ? 'Présent' : 'Absent');
        console.log('🔍 last.image.url:', last.image?.url);
        
        if (last.image && last.image.url) {
          const lastImagePath = path.join(strapi.dirs.static.public, last.image.url);
          console.log('🔍 Chemin dernière capture:', lastImagePath);
          console.log('🔍 Fichier existe?', fs.existsSync(lastImagePath));
          console.log('🔍 Fichier temporaire existe?', fs.existsSync(tempFilePath));
          
          if (fs.existsSync(lastImagePath) && fs.existsSync(tempFilePath)) {
            similarity = await compareImages(lastImagePath, tempFilePath);
            isIdentical = similarity > 95;
            
            console.log(`📸 Comparaison: ${similarity}% - ${isIdentical ? 'IDENTIQUE' : 'DIFFÉRENT'}`);
            
            if (isIdentical) {
              console.log('🔄 Images identiques, remplacement de l\'ancienne...');
              
              if (fs.existsSync(lastImagePath)) {
                fs.unlinkSync(lastImagePath);
                console.log(`🗑️ Ancien fichier supprimé: ${lastImagePath}`);
              }
              
              await strapi.db.query('api::screenshot.screenshot').delete({
                where: { id: last.id }
              });
              console.log(`🗑️ Ancienne entrée supprimée ID: ${last.id}`);
              
              fs.unlinkSync(tempFilePath);
              console.log(`🗑️ Fichier temporaire supprimé`);
              
              const uploadDir = path.join(strapi.dirs.static.public, 'uploads', 'screenshots');
              if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
              }
              
              const finalFilePath = path.join(uploadDir, fileName);
              fs.writeFileSync(finalFilePath, buffer);
              console.log(`📸 Nouveau fichier sauvegardé: ${finalFilePath}`);
              
              const screenshot = await strapi.db.query('api::screenshot.screenshot').create({
                data: {
                  user: user.id,
                  project: projectId || null,
                  captured_at: new Date().toISOString(),
                  is_identical: true,
                  similarity_score: similarity,
                  file_hash: computeHash(buffer),
                  file_size: buffer.length,
                  device_info: {},
                  ip_address: ctx.request.ip,
                  publishedAt: new Date().toISOString()
                }
              });
              
              const screenshotId = screenshot.id;
              await uploadImage(strapi, finalFilePath, fileName, buffer, screenshotId);
              
              console.log(`✅ Capture identique sauvegardée - ID: ${screenshotId}`);
              
              return ctx.send({
                success: true,
                data: {
                  screenshot,
                  is_identical: true,
                  similarity_score: similarity,
                  message: 'Capture identique - Ancienne remplacée'
                }
              });
            }
          } else {
            console.log('⚠️ Fichiers manquants pour comparaison');
          }
        } else {
          console.log('⚠️ Pas d\'image dans la dernière capture');
        }
      } else {
        console.log('📸 Première capture de la journée');
      }
      
      // 4. Si différente wila awel capture
      console.log('📸 Sauvegarde d\'une nouvelle capture...');
      
      const uploadDir = path.join(strapi.dirs.static.public, 'uploads', 'screenshots');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const finalFilePath = path.join(uploadDir, fileName);
      fs.writeFileSync(finalFilePath, buffer);
      fs.unlinkSync(tempFilePath);
      console.log(`📸 Nouveau fichier sauvegardé: ${finalFilePath}`);
      
      const screenshot = await strapi.db.query('api::screenshot.screenshot').create({
        data: {
          user: user.id,
          project: projectId || null,
          captured_at: new Date().toISOString(),
          is_identical: false,
          similarity_score: similarity,
          file_hash: computeHash(buffer),
          file_size: buffer.length,
          device_info: {},
          ip_address: ctx.request.ip,
          publishedAt: new Date().toISOString()
        }
      });
      
      const screenshotId = screenshot.id;
      await uploadImage(strapi, finalFilePath, fileName, buffer, screenshotId);
      
      console.log(`✅ Nouvelle capture sauvegardée - ID: ${screenshotId}`);
      
      return ctx.send({
        success: true,
        data: {
          screenshot,
          is_identical: false,
          similarity_score: similarity,
          message: 'Nouvelle capture ajoutée'
        }
      });
      
    } catch (error) {
      console.error('❌ Erreur capture:', error);
      return ctx.internalServerError('Erreur lors de la capture: ' + error.message);
    }
  },
  
  // Récupérer les captures du jour
  async getTodayScreenshots(ctx: any) {
    try {
      console.log('🔵 [getTodayScreenshots] Début');
      
      const { user } = ctx.state;
      
      if (!user) {
        console.error('❌ Utilisateur non authentifié');
        return ctx.unauthorized('Non authentifié');
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const screenshots = await strapi.db.query('api::screenshot.screenshot').findMany({
        where: {
          user: { id: user.id },
          captured_at: { 
            $gte: today.toISOString(), 
            $lt: tomorrow.toISOString() 
          }
        },
        orderBy: { captured_at: 'asc' },
        populate: ['image', 'project']
      });
      
      console.log(`📸 ${screenshots.length} captures trouvées pour aujourd'hui`);
      
      return ctx.send({
        success: true,
        data: screenshots
      });
      
    } catch (error) {
      console.error('❌ Erreur getTodayScreenshots:', error);
      return ctx.internalServerError('Erreur lors de la récupération: ' + error.message);
    }
  },
  
// Exporter les données pour le module IA
async exportForAI(ctx: any) {
  try {
    console.log('🤖 [AI] Export des données pour IA');
    
    // 🔥 Récupérer le token manuellement mel headers
    const authHeader = ctx.request.headers.authorization;
    let userId = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      try {
        // Décoder le token chnrecuperi user
        const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        userId = decoded.id;
        console.log('🔑 User ID depuis token:', userId);
      } catch (err) {
        console.error('Erreur décodage token:', err);
      }
    }
    
    // récupérer depuis ctx.state.user
    const { user } = ctx.state;
    const finalUserId = user?.id || userId;
    
    if (!finalUserId) {
      console.error('❌ Utilisateur non authentifié');
      return ctx.unauthorized('Non authentifié');
    }
    
    const { startDate, endDate } = ctx.query;
    console.log('📅 Période:', startDate, '→', endDate);
    
    // 1. Récupérer screesonhots
    const screenshots = await strapi.db.query('api::screenshot.screenshot').findMany({
      where: {
        user: { id: finalUserId },
        captured_at: { 
          $gte: startDate || new Date().toISOString(), 
          $lte: endDate || new Date().toISOString()
        }
      }
    });
    
    // 2. Récupérer logs d'activité
    const activityLogs = await strapi.db.query('api::activity-log.activity-log').findMany({
      where: {
        user: { id: finalUserId },
        recorded_at: { 
          $gte: startDate || new Date().toISOString(), 
          $lte: endDate || new Date().toISOString()
        }
      }
    });
    
    // 3. Récupérer attendances
    const attendances = await strapi.db.query('api::attendance.attendance').findMany({
      where: {
        users_permissions_user: { id: finalUserId },
        date: { 
          $gte: startDate || new Date().toISOString(), 
          $lte: endDate || new Date().toISOString()
        }
      }
    });
    
    // 4. Récupérer  tâches
    const tasks = await strapi.db.query('api::task.task').findMany({
      where: {
        assigned_to: { id: finalUserId }
      }
    });
    
    // 5. Calculer les statistiques
    const totalScreenshots = screenshots.length;
    const identicalScreenshots = screenshots.filter(s => s.is_identical === true).length;
    const avgSimilarity = totalScreenshots > 0 
      ? screenshots.reduce((sum, s) => sum + (s.similarity_score || 0), 0) / totalScreenshots 
      : 0;
    
    const totalKeyboardClicks = activityLogs.reduce((sum, a) => sum + (a.keyboard_clicks || 0), 0);
    const totalMouseClicks = activityLogs.reduce((sum, a) => sum + (a.mouse_clicks || 0), 0);
    const avgActivityLevel = activityLogs.length > 0 
      ? activityLogs.reduce((sum, a) => sum + (a.activity_level || 0), 0) / activityLogs.length 
      : 0;
    
    const totalWorkHours = attendances.reduce((sum, a) => sum + (a.work_hours || 0), 0);
    const daysPresent = attendances.filter(a => a.statuts === 'PRESENT').length;
    const daysLate = attendances.filter(a => a.statuts === 'LATE').length;
    
    const completedTasks = tasks.filter(t => t.statuts === 'DONE').length;
    const totalTasks = tasks.length;
    
    console.log('📊 Statistiques calculées:', {
      screenshots: totalScreenshots,
      identical: identicalScreenshots,
      activity: avgActivityLevel,
      workHours: totalWorkHours,
      tasks: completedTasks + '/' + totalTasks
    });
    
    return ctx.send({
      success: true,
      data: {
        employee_id: finalUserId,
        period: { start_date: startDate, end_date: endDate },
        screenshots: {
          total: totalScreenshots,
          identical: identicalScreenshots,
          avg_similarity: Math.round(avgSimilarity)
        },
        activity: {
          keyboard_clicks: totalKeyboardClicks,
          mouse_clicks: totalMouseClicks,
          avg_activity_level: Math.round(avgActivityLevel)
        },
        attendance: {
          total_work_hours: totalWorkHours,
          days_present: daysPresent,
          days_late: daysLate,
          avg_hours_per_day: daysPresent > 0 ? totalWorkHours / daysPresent : 0
        },
        tasks: {
          total: totalTasks,
          completed: completedTasks,
          completion_rate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur export IA:', error);
    return ctx.internalServerError('Erreur lors de l\'export pour IA: ' + error.message);
  }
}
}));