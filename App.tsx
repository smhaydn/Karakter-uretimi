import React, { useState } from 'react';
import { 
  Wand2, 
  Download, 
  Settings2, 
  RefreshCw, 
  Trash2, 
  Layers,
  Info,
  ChevronDown
} from 'lucide-react';

import { ApiKeyManager } from './components/ApiKeyManager';
import { ImageUploader } from './components/ImageUploader';
import { generatePersonaImage } from './services/geminiService';
import { GeneratedImage, AspectRatio, ImageSize } from './types';

// Utility for creating unique IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

function App() {
  // State
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  
  // Settings
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.ONE_K);

  // Handlers
  const handleGenerate = async () => {
    if (!referenceImage) {
      alert("Please upload a reference image of your model first.");
      return;
    }
    if (!prompt.trim()) {
      alert("Please enter a prompt describing the pose, setting, and outfit.");
      return;
    }

    setIsGenerating(true);

    try {
      const images = await generatePersonaImage({
        prompt,
        referenceImage,
        aspectRatio,
        imageSize
      });

      const newImages = images.map(url => ({
        id: generateId(),
        url,
        prompt,
        timestamp: Date.now()
      }));

      setGeneratedImages(prev => [...newImages, ...prev]);
    } catch (error: any) {
      if (error.message === "API_KEY_INVALID") {
          alert("API Key invalid or expired. Please re-select your key.");
          setApiKeyReady(false); // Triggers re-auth flow
      } else {
          alert("Generation failed: " + (error.message || "Unknown error"));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (url: string, id: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `persona-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = (id: string) => {
    setGeneratedImages(prev => prev.filter(img => img.id !== id));
  };

  return (
    <div className="min-h-screen bg-black text-neutral-200 selection:bg-violet-500/30">
      
      {/* Header */}
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-tr from-violet-600 to-fuchsia-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-900/20">
              <Layers size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              HyperReal <span className="text-neutral-500 font-normal">Persona Generator</span>
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
             {/* API Key Status / Manager */}
             <ApiKeyManager onReady={() => setApiKeyReady(true)} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!apiKeyReady ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
             <div className="p-6 bg-neutral-900/50 rounded-3xl border border-neutral-800 max-w-lg">
                <div className="w-16 h-16 bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Settings2 size={32} className="text-neutral-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Configure Access</h2>
                <p className="text-neutral-400 mb-6">
                    Connect your Google AI Studio account to unlock the <strong>Gemini 3 Pro Vision</strong> model capabilities. 
                    This model is required for generating 2K/4K photorealistic datasets.
                </p>
                {/* The ApiKeyManager in the header handles the logic, but visual prompt here is helpful. 
                    User interacts with the header or we could move the connection UI here.
                    For simplicity, we rely on the header or show a prompt. 
                */}
                <p className="text-sm text-violet-400 animate-pulse">
                    Please use the "Select API Key" button above to continue.
                </p>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Sidebar: Controls */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Reference Section */}
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                        <span className="w-1 h-4 bg-violet-500 rounded-full"></span>
                        Reference Model
                    </h2>
                    <span className="text-xs px-2 py-1 bg-neutral-800 rounded text-neutral-400">Required</span>
                </div>
                <ImageUploader 
                  selectedImage={referenceImage}
                  onImageSelected={setReferenceImage}
                />
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex gap-3">
                    <Info className="text-blue-400 flex-shrink-0" size={16} />
                    <p className="text-xs text-blue-300/80 leading-relaxed">
                        Upload your base character image. The model will use this to maintain facial features and body type across generated variations.
                    </p>
                </div>
              </div>

              {/* Settings Section */}
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5 space-y-6">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="w-1 h-4 bg-fuchsia-500 rounded-full"></span>
                    Output Configuration
                </h2>

                {/* Aspect Ratio */}
                <div className="space-y-3">
                    <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Aspect Ratio</label>
                    <div className="grid grid-cols-3 gap-2">
                        {Object.values(AspectRatio).map((ratio) => (
                            <button
                                key={ratio}
                                onClick={() => setAspectRatio(ratio)}
                                className={`
                                    px-3 py-2 rounded-lg text-sm font-medium transition-all
                                    ${aspectRatio === ratio 
                                        ? 'bg-neutral-100 text-neutral-900 shadow-lg shadow-white/10' 
                                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'}
                                `}
                            >
                                {ratio}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Resolution */}
                <div className="space-y-3">
                    <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Resolution (Gemini 3 Pro)</label>
                    <div className="grid grid-cols-3 gap-2">
                        {Object.values(ImageSize).map((size) => (
                            <button
                                key={size}
                                onClick={() => setImageSize(size)}
                                className={`
                                    px-3 py-2 rounded-lg text-sm font-medium transition-all relative overflow-hidden
                                    ${imageSize === size 
                                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40' 
                                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'}
                                `}
                            >
                                {size}
                                {size === ImageSize.FOUR_K && <span className="absolute top-0 right-0 w-2 h-2 bg-yellow-400 rounded-full m-1"></span>}
                            </button>
                        ))}
                    </div>
                </div>
              </div>
            </div>

            {/* Right Panel: Generation & Results */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Prompt Input */}
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-1">
                <div className="relative">
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe the new pose, environment, camera angle, and lighting (e.g. 'Standing in a neon-lit futuristic street, side profile, wearing a leather jacket, cinematic lighting, 85mm lens')..."
                        className="w-full bg-transparent text-lg text-white placeholder-neutral-500 p-6 min-h-[140px] focus:outline-none resize-none"
                    />
                    <div className="absolute bottom-4 right-4 flex items-center space-x-3">
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !referenceImage || !prompt.trim()}
                            className={`
                                flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold text-white shadow-lg transition-all
                                ${isGenerating 
                                    ? 'bg-neutral-800 cursor-not-allowed opacity-80' 
                                    : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:scale-105 hover:shadow-violet-900/30'}
                            `}
                        >
                            {isGenerating ? (
                                <>
                                    <RefreshCw className="animate-spin" size={18} />
                                    <span>Designing...</span>
                                </>
                            ) : (
                                <>
                                    <Wand2 size={18} />
                                    <span>Generate Variation</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
              </div>

              {/* Gallery */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-lg font-semibold text-white">Generation History</h3>
                    <span className="text-sm text-neutral-500">{generatedImages.length} Assets Created</span>
                </div>
                
                {generatedImages.length === 0 ? (
                    <div className="h-64 border border-dashed border-neutral-800 rounded-2xl flex flex-col items-center justify-center text-neutral-500 space-y-2 bg-neutral-900/20">
                        <div className="p-4 bg-neutral-900 rounded-full">
                            <Layers size={24} className="opacity-50" />
                        </div>
                        <p>No variations generated yet.</p>
                        <p className="text-xs">Upload a reference and define a prompt to start building your LoRA dataset.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {generatedImages.map((img) => (
                            <div key={img.id} className="group relative bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                <div className="aspect-square relative overflow-hidden bg-black/50">
                                    <img 
                                        src={img.url} 
                                        alt="Generated variation" 
                                        className="w-full h-full object-contain"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-4 backdrop-blur-sm">
                                        <button 
                                            onClick={() => handleDownload(img.url, img.id)}
                                            className="p-3 bg-white text-black rounded-full hover:bg-neutral-200 transition-colors transform hover:scale-110"
                                            title="Download High Res"
                                        >
                                            <Download size={20} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(img.id)}
                                            className="p-3 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500 hover:text-white transition-colors transform hover:scale-110"
                                            title="Delete Asset"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <p className="text-sm text-neutral-300 line-clamp-2" title={img.prompt}>
                                        {img.prompt}
                                    </p>
                                    <div className="flex items-center justify-between mt-3 text-xs text-neutral-500">
                                        <span>{new Date(img.timestamp).toLocaleTimeString()}</span>
                                        <span className="uppercase">{imageSize}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;