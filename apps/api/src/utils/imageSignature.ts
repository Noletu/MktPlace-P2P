/**
 * Detecção de tipo de imagem por assinatura (magic bytes).
 *
 * Não confia no mimetype/extensão declarados pelo cliente (falsificáveis):
 * inspeciona os bytes iniciais do buffer. Usado para validar uploads antes
 * de passá-los ao processamento de imagem (sharp/OCR).
 *
 * Formatos aceitos: JPEG, PNG, WebP, GIF (rasters comuns de foto/scan).
 * SVG é deliberadamente recusado (XML/vetor — risco de conteúdo ativo).
 */

export type DetectedImageType = 'jpeg' | 'png' | 'webp' | 'gif';

export function detectImageType(buffer: Buffer): DetectedImageType | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // GIF: 47 49 46 38 ("GIF8", cobre GIF87a e GIF89a)
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return 'gif';
  }

  // WebP: "RIFF" (bytes 0-3) .... "WEBP" (bytes 8-11)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp';
  }

  return null;
}
