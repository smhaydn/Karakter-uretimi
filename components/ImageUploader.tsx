import React, { useCallback, useState } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface ImageUploaderProps {
  onImageSelected: (base64: string | null) => void;
  selectedImage: string | null;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected, selectedImage }) => {
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
      onImageSelected(reader.result as string);
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

  const clearImage = () => {
    onImageSelected(null);
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-neutral-400 mb-2">Reference Character</label>
      
      {!selectedImage ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative group flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-all duration-300 cursor-pointer overflow-hidden
            ${isDragging ? 'border-violet-500 bg-violet-500/10' : 'border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 hover:bg-neutral-900'}
          `}
        >
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileChange} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
          />
          
          <div className="flex flex-col items-center space-y-3 text-neutral-500 group-hover:text-neutral-300 transition-colors">
            <div className={`p-4 rounded-full ${isDragging ? 'bg-violet-500/20 text-violet-400' : 'bg-neutral-800 text-neutral-600 group-hover:bg-neutral-800/80 group-hover:text-neutral-400'}`}>
                <Upload size={24} />
            </div>
            <div className="text-center px-4">
                <p className="text-sm font-medium">Click or drop image</p>
                <p className="text-xs text-neutral-600 mt-1">Supports JPG, PNG (Max 5MB)</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative w-full h-64 rounded-xl overflow-hidden border border-neutral-800 group">
            {/* Background Blur for aesthetics */}
            <div 
                className="absolute inset-0 bg-cover bg-center blur-xl opacity-30" 
                style={{ backgroundImage: `url(${selectedImage})` }}
            />
            
            {/* Actual Image */}
            <img 
                src={selectedImage} 
                alt="Reference" 
                className="absolute inset-0 w-full h-full object-contain z-10" 
            />

            {/* Remove Button */}
            <button
                onClick={clearImage}
                className="absolute top-2 right-2 z-20 p-2 bg-black/60 hover:bg-red-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"
            >
                <X size={16} />
            </button>
            
            <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-3">
                <div className="flex items-center space-x-2 text-xs text-neutral-300">
                    <ImageIcon size={12} />
                    <span className="truncate">Reference Loaded</span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};