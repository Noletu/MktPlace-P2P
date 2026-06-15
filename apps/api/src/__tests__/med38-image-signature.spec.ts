import { detectImageType } from '../utils/imageSignature';

// Cria um buffer de `totalLen` bytes começando com a assinatura informada
function withSignature(bytes: number[], totalLen = 16): Buffer {
  const buf = Buffer.alloc(totalLen);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes[i];
  return buf;
}

describe('MED-38 — detecção de imagem por magic bytes (detectImageType)', () => {
  it('detecta JPEG (FF D8 FF)', () => {
    expect(detectImageType(withSignature([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
  });

  it('detecta PNG (89 50 4E 47 0D 0A 1A 0A)', () => {
    expect(detectImageType(withSignature([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
  });

  it('detecta GIF (GIF89a)', () => {
    expect(detectImageType(withSignature([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe('gif');
  });

  it('detecta WebP (RIFF....WEBP)', () => {
    expect(
      detectImageType(withSignature([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]))
    ).toBe('webp');
  });

  it('rejeita texto puro', () => {
    expect(detectImageType(Buffer.from('isto definitivamente nao e uma imagem', 'utf8'))).toBeNull();
  });

  it('rejeita PDF (%PDF)', () => {
    expect(detectImageType(withSignature([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]))).toBeNull();
  });

  it('rejeita SVG (XML/vetor)', () => {
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'utf8'))).toBeNull();
  });

  it('rejeita buffer muito curto (< 12 bytes), mesmo com magic de JPEG', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
  });

  it('rejeita buffer vazio', () => {
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});
