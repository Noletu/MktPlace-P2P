import { Router } from 'express';
import multer from 'multer';
import { boletoController } from '../controllers/boleto.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Configurar multer para upload de imagens
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas imagens
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas'));
    }
  },
});

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Validar código de barras
router.post('/validate', boletoController.validateBarcode.bind(boletoController));

// Extrair dados via OCR
router.post(
  '/extract',
  upload.single('image'),
  boletoController.extractFromImage.bind(boletoController)
);

export default router;
