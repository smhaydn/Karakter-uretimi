
import React, { useState, useEffect, useRef } from 'react';
import { 
  Wand2, 
  Download, 
  Settings2, 
  RefreshCw, 
  Trash2, 
  Layers,
  FileText,
  ListTodo,
  Sparkles,
  Film,
  Aperture,
  Package,
  Eye,
  Play,
  Square,
  Zap,
  LayoutGrid
} from 'lucide-react';

import JSZip from 'jszip';
import saveAs from 'file-saver';

import { ApiKeyManager } from './components/ApiKeyManager';
import { ImageUploader } from './components/ImageUploader';
import { 
    generatePersonaImage, 
    generateVisionCaption, 
    generateSketch, 
    evaluateImageQuality 
} from './services/geminiService';
import { GeneratedImage, AspectRatio, ImageSize, AnchorImage, ReferenceMap, ReferenceSlotId } from './types';
import { DATASET_PLAN } from './utils/datasetPlan';

// Utility for creating unique IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

type Mode = 'FREE' | 'DATASET';
type AutoPilotPhase = 'IDLE' | 'SKETCHING' | 'GENERATING' | 'JUDGING' | 'CAPTIONING' | 'WAITING';

// Define the 5 reference slots
const REFERENCE_SLOTS: { id: ReferenceSlotId; label: string; subLabel: string; required: boolean }[] = [
  { id: 'front', label: '1. Front View', subLabel: 'Passport style (Essential)', required: true },
  { id: 'side', label: '2. Side Profile', subLabel: 'General Profile', required: false },
  { id: 'threeQuarter', label: '3. 3/4 Angle', subLabel: 'Depth reference', required: false },
  { id: 'expression', label: '4. Expression', subLabel: 'Smiling/Laughing', required: false },
  { id: 'side90', label: '5. 90° Side View', subLabel: 'Strict 90° Angle', required: false },
];

function App() {
  // State
  const [apiKeyReady, setApiKeyReady] = useState(false);
  
  // New Reference State: Map of ID -> Base64
  const [referenceImages, setReferenceImages] = useState<ReferenceMap>({
    front: null,
    side: null,
    threeQuarter: null,
    expression: null,
    side90: null
  });
  
  // Mode State
  const [mode, setMode] = useState<Mode>('FREE');
  
  // Free Mode State
  const [prompt, setPrompt] = useState("");
  
  // Dataset Mode State
  const [datasetIndex, setDatasetIndex] = useState(0);
  const [triggerWord, setTriggerWord] = useState("Lola kizil woman");

  // Common State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  
  // Factory Mode State
  const [isAutoPilot, setIsAutoPilot] = useState(false);
  
  // Ref to track auto-pilot state instantly (avoids closure staleness)
  const isAutoPilotRef = useRef(false);
  
  // Ref to track dataset index instantly (avoids closure staleness in recursion)
  const datasetIndexRef = useRef(0);

  const [pilotPhase, setPilotPhase] = useState<AutoPilotPhase>('IDLE');
  // retryCount is kept for UI display if needed, but logic removed
  const [retryCount, setRetryCount] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentSketch, setCurrentSketch] = useState<string | null>(null);
  
  const autoPilotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Settings
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.ONE_K);
  const [isRawMode, setIsRawMode] = useState(true);

  // Helper: Check if we have the minimum required reference
  const hasRequiredReference = !!referenceImages.front;

  const handleImageUpdate = (id: string, base64: string | null) => {
    setReferenceImages(prev => ({
        ...prev,
        [id]: base64
    }));
  };
  
  // Sync state to ref
  useEffect(() => {
    datasetIndexRef.current = datasetIndex;
  }, [datasetIndex]);

  // --- Auto-Pilot Loop ---
  const runAutoPilotStep = async () => {
     // Use Ref for immediate check
     if (!isAutoPilotRef.current || !hasRequiredReference) return;

     // Use Ref for index to avoid stale closures
     const currentIndex = datasetIndexRef.current;

     // Safety Check
     if (currentIndex >= DATASET_PLAN.length) {
         stopAutoPilot();
         return;
     }

     const item = DATASET_PLAN[currentIndex];
     
     try {
         // --- PHASE 1: SKETCHING (Pose Mimicry) ---
         setPilotPhase('SKETCHING');
         console.log(`[AutoPilot] Phase 1: Sketching pose for ${item.shot}`);
         
         const sketchPrompt = `${item.shot}, ${item.expression} expression, ${item.outfit}, body pose: ${item.description}`;
         const sketchUrl = await generateSketch(sketchPrompt, aspectRatio);
         
         // CHECKPOINT 1: Stop if user clicked stop during sketch
         if (!isAutoPilotRef.current) return;

         setCurrentSketch(sketchUrl);

         // --- PHASE 2: GENERATION (Multi-Reference) ---
         setPilotPhase('GENERATING');
         console.log(`[AutoPilot] Phase 2: Generating Final Image...`);
         
         const structuredPrompt = `${item.shot} of a woman, ${item.expression} expression, wearing ${item.outfit}, ${item.lighting} lighting. ${item.description}`;
         
         const images = await generatePersonaImage({
            prompt: structuredPrompt,
            referenceImages: referenceImages, // Pass the map
            aspectRatio,
            imageSize,
            isRawMode
         }, sketchUrl, []); 
         
         // CHECKPOINT 2: Stop if user clicked stop during generation
         if (!isAutoPilotRef.current) return;
         
         const generatedUrl = images[0];

         // --- PHASE 3: CURATION (The Judge) ---
         setPilotPhase('JUDGING');
         console.log(`[AutoPilot] Phase 3: Judging Quality...`);
         
         const score = await evaluateImageQuality(generatedUrl);
         console.log(`[AutoPilot] Judge Score: ${score}/10`);

         // CHECKPOINT 3: Stop if user clicked stop during judging
         if (!isAutoPilotRef.current) return;

         // NO RETRY LOOP: Proceed regardless of score
         setRetryCount(0); 
         setCurrentSketch(null);
         
         // --- PHASE 4: CAPTIONING & SAVING ---
         setPilotPhase('CAPTIONING');
         
         const tempId = generateId();
         
         const newImage: GeneratedImage = {
            id: tempId,
            url: generatedUrl,
            prompt: structuredPrompt,
            caption: "Generating caption...",
            timestamp: Date.now(),
            isDataset: true,
            datasetId: item.id,
            isAnalyzing: true,
            qualityScore: score,
            isAnchor: false
         };

         setGeneratedImages(prev => [newImage, ...prev]);

         const initialCaption = `${triggerWord}, ${item.shot} of a woman, ${item.description}, ${item.expression}, ${item.outfit}, ${item.lighting}`;
         const visionCaption = await generateVisionCaption(generatedUrl, triggerWord);
         
         setGeneratedImages(prev => prev.map(img => 
            img.id === tempId 
                ? { ...img, caption: visionCaption || initialCaption, isAnalyzing: false } 
                : img
         ));

         // INCREMENT INDEX
         const nextIndex = currentIndex + 1;
         console.log(`[AutoPilot] Moving to next item: ${currentIndex} -> ${nextIndex}`);
         setDatasetIndex(nextIndex);
         datasetIndexRef.current = nextIndex; // Immediate update for next loop validity

         // --- PHASE 5: WAITING (Rate Limit) ---
         // CHECKPOINT 4: Stop if user clicked stop before waiting
         if (!isAutoPilotRef.current) return;

         setPilotPhase('WAITING');
         console.log(`[AutoPilot] Step Complete. Waiting 4s...`);
         
         autoPilotTimerRef.current = setTimeout(() => {
             // Only recurse if still active
             if (isAutoPilotRef.current) {
                runAutoPilotStep(); 
             }
         }, 4000);

     } catch (error) {
         console.error("AutoPilot Error:", error);
         stopAutoPilot();
         alert("Auto-Pilot stopped due to an error.");
     }
  };

  const stopAutoPilot = () => {
    setIsAutoPilot(false);
    isAutoPilotRef.current = false; // Immediate kill switch
    setPilotPhase('IDLE');
    if (autoPilotTimerRef.current) clearTimeout(autoPilotTimerRef.current);
  };

  const startAutoPilot = () => {
    if (!hasRequiredReference) {
        alert("Please upload at least the Front View reference.");
        return;
    }
    if (datasetIndex >= DATASET_PLAN.length) {
        alert("Dataset plan completed.");
        return;
    }
    setIsAutoPilot(true);
    isAutoPilotRef.current = true; // Enable execution
  };

  // Trigger effect when starting
  useEffect(() => {
      if (isAutoPilot && pilotPhase === 'IDLE') {
          runAutoPilotStep();
      }
      return () => {
          if (autoPilotTimerRef.current) clearTimeout(autoPilotTimerRef.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoPilot]);

  // --- Handlers ---
  const handleFreeGenerate = async () => {
    if (!hasRequiredReference) {
      alert("Please upload at least the Front View (Slot 1) reference.");
      return;
    }
    if (!prompt.trim()) {
      alert("Please enter a prompt.");
      return;
    }
    
    setIsGenerating(true);
    try {
        const images = await generatePersonaImage({
            prompt,
            referenceImages: referenceImages,
            aspectRatio,
            imageSize,
            isRawMode
        }, null, []); 

        const url = images[0];
        const tempId = generateId();
        
        setGeneratedImages(prev => [{
            id: tempId,
            url,
            prompt,
            caption: prompt,
            timestamp: Date.now(),
            isDataset: false,
            isAnalyzing: true
        }, ...prev]);

        generateVisionCaption(url, triggerWord).then(cap => {
            setGeneratedImages(prev => prev.map(i => i.id === tempId ? {...i, caption: cap || prompt, isAnalyzing: false} : i));
        });

    } catch (e: any) {
        alert(e.message);
    } finally {
        setIsGenerating(false);
    }
  };

  // Helper UI Handlers
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

  const handleBatchDownload = async () => {
    if (generatedImages.length === 0) return;
    const zip = new JSZip();
    const imagesFolder = zip.folder("images");
    const captionsFolder = zip.folder("captions");
    if (!imagesFolder || !captionsFolder) return;
    const getBase64Data = (url: string) => url.split(',')[1];
    generatedImages.forEach((img, index) => {
        const padIndex = (generatedImages.length - index).toString().padStart(3, '0');
        const fileName = `${triggerWord.split(' ')[0]}_${padIndex}`;
        imagesFolder.file(`${fileName}.png`, getBase64Data(img.url), { base64: true });
        captionsFolder.file(`${fileName}.txt`, img.caption);
    });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "dataset_bundle.zip");
  };

  const handleDelete = (id: string) => {
    setGeneratedImages(prev => prev.filter(img => img.id !== id));
  };

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
              HyperReal <span className="text-neutral-500 font-normal">Factory Mode</span>
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
              
              {/* Reference Grid Section */}
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                        <span className="w-1 h-4 bg-violet-500 rounded-full"></span>
                        Character Sheet (Multi-View)
                    </h2>
                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 bg-neutral-800 px-2 py-1 rounded">
                        <LayoutGrid size={10} />
                        <span>5 Slots</span>
                    </div>
                </div>
                
                {/* 5-Slot Grid */}
                <div className="grid grid-cols-2 gap-2">
                    {REFERENCE_SLOTS.map((slot, index) => (
                        <div key={slot.id} className={index === 4 ? "col-span-2" : ""}>
                            <ImageUploader 
                                id={slot.id}
                                label={slot.label}
                                subLabel={slot.subLabel}
                                isRequired={slot.required}
                                selectedImage={referenceImages[slot.id]}
                                onImageSelected={handleImageUpdate}
                            />
                        </div>
                    ))}
                </div>
                
                {!hasRequiredReference && (
                    <div className="text-xs text-red-400 bg-red-400/10 p-2 rounded text-center">
                        Upload the "Front View" to enable generation.
                    </div>
                )}
              </div>

              {/* Mode Selection */}
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-2 flex">
                  <button 
                    onClick={() => setMode('FREE')}
                    disabled={isAutoPilot}
                    className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl text-sm font-medium transition-all ${mode === 'FREE' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                  >
                    <Sparkles size={16} />
                    <span>Free Roam</span>
                  </button>
                  <button 
                    onClick={() => setMode('DATASET')}
                    disabled={isAutoPilot}
                    className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl text-sm font-medium transition-all ${mode === 'DATASET' ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                  >
                    <ListTodo size={16} />
                    <span>Factory Mode</span>
                  </button>
              </div>

              {/* Shared Settings */}
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5 space-y-6">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="w-1 h-4 bg-fuchsia-500 rounded-full"></span>
                    Tech Specs
                </h2>
                
                {/* Raw Mode Toggle */}
                <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-neutral-800/50">
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${isRawMode ? 'bg-orange-500/20 text-orange-400' : 'bg-neutral-800 text-neutral-500'}`}>
                            {isRawMode ? <Film size={18} /> : <Aperture size={18} />}
                        </div>
                        <div>
                            <div className="text-sm font-medium text-white">Raw / Analog Mode</div>
                            <div className="text-[10px] text-neutral-500">Adds grain, texture & imperfections</div>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsRawMode(!isRawMode)}
                        disabled={isAutoPilot}
                        className={`w-12 h-6 rounded-full transition-colors relative ${isRawMode ? 'bg-orange-600' : 'bg-neutral-700'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isRawMode ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>

                {/* Aspect Ratio */}
                <div className="space-y-3">
                    <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Aspect Ratio</label>
                    <div className="grid grid-cols-3 gap-2">
                        {Object.values(AspectRatio).map((ratio) => (
                            <button
                                key={ratio}
                                onClick={() => setAspectRatio(ratio)}
                                disabled={isAutoPilot}
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
                                disabled={isAutoPilot}
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
                                disabled={isGenerating || !hasRequiredReference || !prompt.trim()}
                                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold text-white shadow-lg transition-all ${isGenerating ? 'bg-neutral-800 cursor-not-allowed opacity-80' : 'bg-white text-black hover:scale-105'}`}
                            >
                                {isGenerating ? <RefreshCw className="animate-spin" size={18} /> : <Wand2 size={18} />}
                                <span>Generate</span>
                            </button>
                        </div>
                    </div>
                </div>
              ) : (
                /* Factory Mode Input */
                <div className="space-y-4">
                     {/* Trigger Word */}
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 flex items-center gap-4">
                        <label className="text-sm font-medium text-neutral-400 whitespace-nowrap">Trigger Word:</label>
                        <input 
                            type="text" 
                            value={triggerWord}
                            onChange={(e) => setTriggerWord(e.target.value)}
                            disabled={isAutoPilot}
                            className="bg-black/50 border border-neutral-700 rounded-lg px-3 py-2 text-white w-full focus:outline-none focus:border-violet-500"
                            placeholder="e.g. ohwx woman"
                        />
                    </div>

                    {/* Progress & Factory Status */}
                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden">
                        
                        {/* Status Header */}
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <h3 className="text-white font-semibold flex items-center gap-2">
                                <ListTodo size={20} className="text-violet-400"/>
                                Autonomous Factory
                            </h3>
                            <span className="text-violet-400 font-mono font-bold bg-violet-500/10 px-3 py-1 rounded-full">
                                {datasetIndex} / {DATASET_PLAN.length}
                            </span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full bg-neutral-800 h-2 rounded-full mb-6 relative z-10 overflow-hidden">
                            <div 
                                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 h-full transition-all duration-500"
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>

                        {/* FACTORY MONITOR SCREEN */}
                        {isAutoPilot && (
                            <div className="bg-black/80 border border-green-500/30 rounded-xl p-4 mb-4 relative z-10 font-mono text-sm">
                                <div className="flex items-center space-x-2 mb-3 border-b border-white/10 pb-2">
                                    <Zap size={14} className="text-green-400 animate-pulse" />
                                    <span className="text-green-400 font-bold">SYSTEM ACTIVE</span>
                                </div>
                                <div className="space-y-2 text-neutral-300">
                                    <div className="flex justify-between">
                                        <span>Current Task:</span>
                                        <span className="text-white">{currentPlanItem?.shot}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>Phase:</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                            pilotPhase === 'SKETCHING' ? 'bg-orange-500/20 text-orange-400' :
                                            pilotPhase === 'GENERATING' ? 'bg-blue-500/20 text-blue-400' :
                                            pilotPhase === 'JUDGING' ? 'bg-purple-500/20 text-purple-400' :
                                            pilotPhase === 'CAPTIONING' ? 'bg-cyan-500/20 text-cyan-400' :
                                            pilotPhase === 'WAITING' ? 'bg-neutral-700 text-neutral-400' : 'text-white'
                                        }`}>
                                            {pilotPhase === 'SKETCHING' && "1. SKETCHING POSE..."}
                                            {pilotPhase === 'GENERATING' && "2. GENERATING IMAGE..."}
                                            {pilotPhase === 'JUDGING' && "3. AI JUDGING..."}
                                            {pilotPhase === 'CAPTIONING' && "4. CAPTIONING..."}
                                            {pilotPhase === 'WAITING' && "COOLING DOWN..."}
                                        </span>
                                    </div>
                                    {retryCount > 0 && (
                                        <div className="flex justify-between text-red-400">
                                            <span>Retries:</span>
                                            <span>{retryCount} / 3</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Current Item Card */}
                        {!isAutoPilot && currentPlanItem && (
                            <div className="bg-black/40 border border-neutral-700/50 rounded-xl p-4 relative z-10">
                                <div className="text-xs text-neutral-500 uppercase tracking-widest mb-3">Up Next</div>
                                <div className="text-white text-sm font-medium">"{currentPlanItem.description}"</div>
                            </div>
                        )}

                        {/* Controls */}
                        <div className="mt-6 flex items-center justify-end gap-4 relative z-10">
                            <button
                                onClick={isAutoPilot ? stopAutoPilot : startAutoPilot}
                                disabled={datasetIndex >= DATASET_PLAN.length || (!hasRequiredReference && !isAutoPilot)}
                                className={`
                                    flex items-center space-x-2 px-5 py-3 rounded-xl font-semibold transition-all border w-full justify-center
                                    ${isAutoPilot 
                                        ? 'bg-red-500/10 text-red-400 border-red-500/50 hover:bg-red-500/20' 
                                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/20'}
                                    ${datasetIndex >= DATASET_PLAN.length ? 'opacity-50 cursor-not-allowed' : ''}
                                `}
                            >
                                {isAutoPilot ? (
                                    <>
                                        <Square size={16} fill="currentColor" />
                                        <span>EMERGENCY STOP</span>
                                    </>
                                ) : (
                                    <>
                                        <Play size={16} fill="currentColor" />
                                        <span>START AUTONOMOUS FACTORY</span>
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
                    <h3 className="text-lg font-semibold text-white">Production Line Output</h3>
                    <div className="flex items-center gap-3">
                        {generatedImages.length > 0 && (
                            <button 
                                onClick={handleBatchDownload}
                                className="flex items-center space-x-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-white transition-colors border border-neutral-700"
                            >
                                <Package size={16} />
                                <span>Download ZIP</span>
                            </button>
                        )}
                        <span className="text-sm text-neutral-500">{generatedImages.length} Units</span>
                    </div>
                </div>
                
                {generatedImages.length === 0 ? (
                    <div className="h-64 border border-dashed border-neutral-800 rounded-2xl flex flex-col items-center justify-center text-neutral-500 space-y-2 bg-neutral-900/20">
                         <div className="p-4 bg-neutral-900 rounded-full">
                            <Layers size={24} className="opacity-50" />
                        </div>
                        <p>Production line is empty.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {generatedImages.map((img) => (
                            <div key={img.id} className="group relative bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                <div className="aspect-square relative overflow-hidden bg-black/50">
                                    <img 
                                        src={img.url} 
                                        alt="Generated variation" 
                                        className={`w-full h-full object-contain`}
                                        loading="lazy"
                                    />
                                    
                                    {/* Score Badge */}
                                    {img.qualityScore !== undefined && (
                                        <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold shadow-lg z-10 ${
                                            img.qualityScore >= 8 ? 'bg-green-500 text-white' : 
                                            img.qualityScore >= 5 ? 'bg-yellow-500 text-black' : 'bg-red-500 text-white'
                                        }`}>
                                            QS: {img.qualityScore}/10
                                        </div>
                                    )}

                                    {/* Status Overlay */}
                                    {img.isAnalyzing && (
                                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center space-y-2 animate-in fade-in">
                                            <Eye className="text-violet-400 animate-pulse" size={24} />
                                            <span className="text-xs font-medium text-violet-200">Processing...</span>
                                        </div>
                                    )}

                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2 backdrop-blur-sm">
                                        <button onClick={() => handleDownloadImage(img.url, img.id)} className="p-3 bg-white text-black rounded-full hover:scale-110 transition"><Download size={20} /></button>
                                        <button onClick={() => handleDownloadCaption(img.caption, img.id)} className="p-3 bg-blue-500 text-white rounded-full hover:scale-110 transition"><FileText size={20} /></button>
                                        <button onClick={() => handleDelete(img.id)} className="p-3 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500 hover:text-white hover:scale-110 transition"><Trash2 size={20} /></button>
                                    </div>
                                    
                                    {/* Labels */}
                                    {img.isDataset && (
                                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                                            <div className="bg-violet-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg">DATASET #{img.datasetId}</div>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4">
                                    <p className="text-sm text-neutral-300 line-clamp-2" title={img.caption}>{img.caption}</p>
                                    <div className="flex items-center justify-between mt-2 text-xs text-neutral-500">
                                        <span>{new Date(img.timestamp).toLocaleTimeString()}</span>
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
