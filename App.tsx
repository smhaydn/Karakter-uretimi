import React, { useState } from 'react';
import { 
  Wand2, 
  Download, 
  Settings2, 
  RefreshCw, 
  Trash2, 
  Layers,
  Info,
  FileText,
  ListTodo,
  Sparkles
} from 'lucide-react';

import { ApiKeyManager } from './components/ApiKeyManager';
import { ImageUploader } from './components/ImageUploader';
import { generatePersonaImage } from './services/geminiService';
import { GeneratedImage, AspectRatio, ImageSize } from './types';
import { DATASET_PLAN } from './utils/datasetPlan';

// Utility for creating unique IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

type Mode = 'FREE' | 'DATASET';

function App() {
  // State
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  
  // Mode State
  const [mode, setMode] = useState<Mode>('FREE');
  
  // Free Mode State
  const [prompt, setPrompt] = useState("");
  
  // Dataset Mode State
  const [datasetIndex, setDatasetIndex] = useState(0);
  const [triggerWord, setTriggerWord] = useState("ohwx woman");

  // Common State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  
  // Settings
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.ONE_K);

  // --- Handlers ---

  const handleFreeGenerate = async () => {
    if (!referenceImage) {
      alert("Please upload a reference image of your model first.");
      return;
    }
    if (!prompt.trim()) {
      alert("Please enter a prompt.");
      return;
    }
    await executeGeneration(prompt, "Free Roam Generation");
  };

  const handleDatasetGenerate = async () => {
    if (!referenceImage) {
      alert("Please upload a reference image first.");
      return;
    }
    if (datasetIndex >= DATASET_PLAN.length) {
      alert("Dataset plan completed! You have generated all 40 images.");
      return;
    }

    const item = DATASET_PLAN[datasetIndex];
    
    // Construct the structured prompt
    // Structure: [Shot] of a woman, [Expression], wearing [Outfit], [Lighting], [Description]
    const structuredPrompt = `${item.shot} of a woman, ${item.expression} expression, wearing ${item.outfit}, ${item.lighting} lighting. ${item.description}`;
    
    // Construct the Caption for the TXT file
    // Structure: [Trigger], [Shot] ..., [Expression], [Outfit], [Lighting], [Tech Tags]
    const caption = `${triggerWord}, ${item.shot} of a woman, ${item.description}, ${item.expression} expression, wearing ${item.outfit}, ${item.lighting} lighting, 8k, hyper realistic, high quality`;

    await executeGeneration(structuredPrompt, caption, true);
    
    // Advance progress
    setDatasetIndex(prev => prev + 1);
  };

  const executeGeneration = async (promptText: string, captionText: string, isDataset: boolean = false) => {
    setIsGenerating(true);
    try {
      const images = await generatePersonaImage({
        prompt: promptText,
        referenceImage,
        aspectRatio,
        imageSize
      });

      const newImages = images.map(url => ({
        id: generateId(),
        url,
        prompt: promptText,
        caption: captionText, // Save the calculated caption
        timestamp: Date.now(),
        isDataset
      }));

      setGeneratedImages(prev => [...newImages, ...prev]);
    } catch (error: any) {
      if (error.message === "API_KEY_INVALID") {
          alert("API Key invalid or expired. Please re-select your key.");
          setApiKeyReady(false);
      } else {
          alert("Generation failed: " + (error.message || "Unknown error"));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadImage = (url: string, id: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `persona-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadCaption = (caption: string, id: string) => {
    const blob = new Blob([caption], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `persona-${id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDelete = (id: string) => {
    setGeneratedImages(prev => prev.filter(img => img.id !== id));
  };

  // Dataset Progress Calculation
  const currentPlanItem = datasetIndex < DATASET_PLAN.length ? DATASET_PLAN[datasetIndex] : null;
  const progressPercentage = (datasetIndex / DATASET_PLAN.length) * 100;

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
                </p>
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
              </div>

              {/* Mode Selection */}
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-2 flex">
                  <button 
                    onClick={() => setMode('FREE')}
                    className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl text-sm font-medium transition-all ${mode === 'FREE' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                  >
                    <Sparkles size={16} />
                    <span>Free Roam</span>
                  </button>
                  <button 
                    onClick={() => setMode('DATASET')}
                    className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl text-sm font-medium transition-all ${mode === 'DATASET' ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                  >
                    <ListTodo size={16} />
                    <span>Dataset Plan</span>
                  </button>
              </div>

              {/* Shared Settings */}
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5 space-y-6">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="w-1 h-4 bg-fuchsia-500 rounded-full"></span>
                    Tech Specs
                </h2>
                {/* Aspect Ratio */}
                <div className="space-y-3">
                    <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Aspect Ratio</label>
                    <div className="grid grid-cols-3 gap-2">
                        {Object.values(AspectRatio).map((ratio) => (
                            <button
                                key={ratio}
                                onClick={() => setAspectRatio(ratio)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${aspectRatio === ratio ? 'bg-neutral-100 text-neutral-900' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                            >
                                {ratio}
                            </button>
                        ))}
                    </div>
                </div>
                {/* Resolution */}
                <div className="space-y-3">
                    <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Resolution</label>
                    <div className="grid grid-cols-3 gap-2">
                        {Object.values(ImageSize).map((size) => (
                            <button
                                key={size}
                                onClick={() => setImageSize(size)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${imageSize === size ? 'bg-violet-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                            >
                                {size}
                            </button>
                        ))}
                    </div>
                </div>
              </div>
            </div>

            {/* Right Panel: Generation & Results */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* === MODE SPECIFIC INPUT === */}
              {mode === 'FREE' ? (
                /* Free Roam Input */
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-1">
                    <div className="relative">
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe the new pose, environment..."
                            className="w-full bg-transparent text-lg text-white placeholder-neutral-500 p-6 min-h-[140px] focus:outline-none resize-none"
                        />
                        <div className="absolute bottom-4 right-4">
                            <button
                                onClick={handleFreeGenerate}
                                disabled={isGenerating || !referenceImage || !prompt.trim()}
                                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold text-white shadow-lg transition-all ${isGenerating ? 'bg-neutral-800 cursor-not-allowed opacity-80' : 'bg-white text-black hover:scale-105'}`}
                            >
                                {isGenerating ? <RefreshCw className="animate-spin" size={18} /> : <Wand2 size={18} />}
                                <span>Generate</span>
                            </button>
                        </div>
                    </div>
                </div>
              ) : (
                /* Dataset Plan Input */
                <div className="space-y-4">
                    {/* Trigger Word Input */}
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 flex items-center gap-4">
                        <label className="text-sm font-medium text-neutral-400 whitespace-nowrap">Trigger Word:</label>
                        <input 
                            type="text" 
                            value={triggerWord}
                            onChange={(e) => setTriggerWord(e.target.value)}
                            className="bg-black/50 border border-neutral-700 rounded-lg px-3 py-2 text-white w-full focus:outline-none focus:border-violet-500"
                            placeholder="e.g. ohwx woman"
                        />
                        <div className="text-xs text-neutral-500 whitespace-nowrap">Included in .txt captions</div>
                    </div>

                    {/* Progress Bar */}
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <h3 className="text-white font-semibold flex items-center gap-2">
                                <ListTodo size={20} className="text-violet-400"/>
                                Structured Dataset Plan
                            </h3>
                            <span className="text-violet-400 font-mono font-bold bg-violet-500/10 px-3 py-1 rounded-full">
                                {datasetIndex} / {DATASET_PLAN.length}
                            </span>
                        </div>
                        
                        {/* Progress Bar Visual */}
                        <div className="w-full bg-neutral-800 h-2 rounded-full mb-6 relative z-10 overflow-hidden">
                            <div 
                                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 h-full transition-all duration-500"
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>

                        {/* Current Item Card */}
                        {currentPlanItem ? (
                            <div className="bg-black/40 border border-neutral-700/50 rounded-xl p-4 relative z-10">
                                <div className="text-xs text-neutral-500 uppercase tracking-widest mb-3">Next in Queue</div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-neutral-500">Shot:</span> <span className="text-white ml-2">{currentPlanItem.shot}</span></div>
                                    <div><span className="text-neutral-500">Lighting:</span> <span className="text-white ml-2">{currentPlanItem.lighting}</span></div>
                                    <div><span className="text-neutral-500">Emotion:</span> <span className="text-white ml-2">{currentPlanItem.expression}</span></div>
                                    <div><span className="text-neutral-500">Outfit:</span> <span className="text-white ml-2">{currentPlanItem.outfit}</span></div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-neutral-800 text-xs text-neutral-400 italic">
                                    "{currentPlanItem.description}"
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-green-400 relative z-10">
                                Dataset Generation Complete! 🎉
                            </div>
                        )}

                        {/* Button */}
                        <div className="mt-6 flex justify-end relative z-10">
                            <button
                                onClick={handleDatasetGenerate}
                                disabled={isGenerating || !referenceImage || datasetIndex >= DATASET_PLAN.length}
                                className={`
                                    flex items-center space-x-2 px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all
                                    ${isGenerating 
                                        ? 'bg-neutral-800 cursor-not-allowed opacity-80' 
                                        : datasetIndex >= DATASET_PLAN.length 
                                            ? 'bg-green-600 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:shadow-violet-900/30 hover:scale-105'}
                                `}
                            >
                                {isGenerating ? (
                                    <>
                                        <RefreshCw className="animate-spin" size={18} />
                                        <span>Generating {datasetIndex + 1}...</span>
                                    </>
                                ) : (
                                    <>
                                        <Layers size={18} />
                                        <span>Generate Image {datasetIndex + 1} / {DATASET_PLAN.length}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
              )}

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
                        <p className="text-xs">Select a mode and start generating.</p>
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
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2 backdrop-blur-sm">
                                        <button 
                                            onClick={() => handleDownloadImage(img.url, img.id)}
                                            className="p-3 bg-white text-black rounded-full hover:bg-neutral-200 transition-transform transform hover:scale-110"
                                            title="Download Image"
                                        >
                                            <Download size={20} />
                                        </button>
                                        <button 
                                            onClick={() => handleDownloadCaption(img.caption, img.id)}
                                            className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-transform transform hover:scale-110"
                                            title="Download Caption (.txt)"
                                        >
                                            <FileText size={20} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(img.id)}
                                            className="p-3 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500 hover:text-white transition-transform transform hover:scale-110"
                                            title="Delete Asset"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                    {img.isDataset && (
                                        <div className="absolute top-2 left-2 bg-violet-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg">
                                            DATASET
                                        </div>
                                    )}
                                </div>
                                <div className="p-4">
                                    <p className="text-sm text-neutral-300 line-clamp-2" title={img.caption}>
                                        {img.caption}
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