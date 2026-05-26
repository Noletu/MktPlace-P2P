import dotenv from 'dotenv';

// SECURITY (SER-13): Carregado antes de qualquer import que leia process.env no top-level
// (e.g., jwt.ts valida JWT_ACCESS_SECRET/JWT_REFRESH_SECRET ao ser importado).
// Este módulo deve ser a PRIMEIRA importação em cada entry point (index.ts, etc.).
dotenv.config();
