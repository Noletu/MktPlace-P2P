'use client';

import { useState } from 'react';

interface EvidenceGalleryProps {
  attachments: string[];
}

export default function EvidenceGallery({ attachments }: EvidenceGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) {
    return <p className="text-sm text-gray-500">Nenhum anexo</p>;
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {attachments.map((url, idx) => (
          <div
            key={idx}
            onClick={() => setSelectedImage(url)}
            className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition"
          >
            <img
              src={url}
              alt={`Evidência ${idx + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
        >
          <img src={selectedImage} alt="Preview" className="max-w-full max-h-full" />
        </div>
      )}
    </>
  );
}
