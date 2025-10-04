import { Router } from 'express';
import { priceController } from '../controllers/price.controller';

const router = Router();

// Obter cotação de uma criptomoeda
router.get('/:crypto', priceController.getPrice.bind(priceController));

// Obter todas as cotações
router.get('/', priceController.getAllPrices.bind(priceController));

// Converter BRL <-> Crypto
router.post('/convert', priceController.convert.bind(priceController));

export default router;
