
import React, { useState } from 'react';
import { Upload, X, Image as ImageIcon, Check } from 'lucide-react';

interface ImageUploaderProps {
  id: string;
  label: string;
  subLabel?: string;
  isRequired?: boolean;
  onImageSelected: (id: string, base64: string | null) => void;
  selectedImage: string | null;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  id, 
  label, 
  subLabel, 
  isRequired = false, 
  onImageSelected, 
  selectedImage 
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      onImageSelected(id, reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
  };

  const clearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    onImageSelected(id, null);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <label className={`text-xs font-semibold ${isRequired ? 'text-violet-400' : 'text-neutral-400'}`}>
            {label} {isRequired && '*'}
        </label>
        {selectedImage && <Check size={12} className="text-green-500" />}
      </div>
      
      <div className="flex-1 relative">
        {!selectedImage ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative group flex flex-col items-center justify-center w-full h-32 md:h-40 border border-dashed rounded-xl transition-all duration-300 cursor-pointer overflow-hidden
              ${isDragging ? 'border-violet-500 bg-violet-500/10' : 'border-neutral-800 bg-neutral-900/30 hover:border-neutral-700 hover:bg-neutral-900'}
            `}
          >
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileChange} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
            />
            
            <div className="flex flex-col items-center space-y-2 text-neutral-600 group-hover:text-neutral-400 transition-colors p-2 text-center">
              <div className={`p-2 rounded-full ${isDragging ? 'bg-violet-500/20 text-violet-400' : 'bg-neutral-800/50'}`}>
                  <Upload size={16} />
              </div>
              {subLabel && <p className="text-[10px] leading-tight opacity-70">{subLabel}</p>}
            </div>
          </div>
        ) : (
          <div className="relative w-full h-32 md:h-40 rounded-xl overflow-hidden border border-neutral-700 group bg-neutral-900">
              {/* Actual Image */}
              <img 
                  src={selectedImage} 
                  alt={label} 
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
              />

              {/* Remove Button */}
              <button
                  onClick={clearImage}
                  className="absolute top-1 right-1 z-20 p-1.5 bg-black/60 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"
              >
                  <X size={12} />
              </button>
              
              <div className="absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-black/90 to-transparent p-2">
                  <div className="flex items-center space-x-1.5 text-[10px] text-neutral-300">
                      <ImageIcon size={10} />
                      <span className="truncate max-w-[90%]">Loaded</span>
                  </div>
              </div>
          </div>
        )}
      </div>
    </div>
  );
};
