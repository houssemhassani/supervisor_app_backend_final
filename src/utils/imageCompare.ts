// backend/src/utils/imageCompare.ts
import * as fs from 'fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export async function compareImages(imagePath1: string, imagePath2: string): Promise<number> {
  console.log('🔍 [COMPARE] Début comparaison');
  console.log('🔍 Image 1:', imagePath1);
  console.log('🔍 Image 2:', imagePath2);
  
  // Vérifier si les fichiers existent
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