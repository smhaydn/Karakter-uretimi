import React, { useState, useEffect } from 'react';
import { Key, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

interface ApiKeyManagerProps {
  onReady: () => void;
}

export const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ onReady }) => {
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkKey = async () => {
    try {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
        if (selected) {
          onReady();
        }
      } else {
        // Fallback for dev environments without the specific window object
        // Assuming env var might be present or we just show connected state for UI dev
        if (process.env.API_KEY) {
            setHasKey(true);
            onReady();
        }
      }
    } catch (err) {
      console.error("Error checking API key", err);
      setError("Failed to verify API key status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
        // Assume success after dialog interaction, retry check
        await checkKey();
      } else {
        setError("AI Studio environment not detected.");
      }
    } catch (err) {
        console.error(err);
        setError("Failed to open key selection dialog.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-violet-500"></div>
        <span className="ml-2 text-neutral-400">Verifying access...</span>
      </div>
    );
  }

  if (hasKey) {
    return (
        <div className="flex items-center space-x-2 text-green-500 bg-green-500/10 px-3 py-1.5 rounded-full text-xs font-medium border border-green-500/20">
            <CheckCircle size={14} />
            <span>AI Studio Connected</span>
        </div>
    );
  }

  return (
    <div className="flex flex-col items-start space-y-3 bg-neutral-900 border border-neutral-800 p-4 rounded-xl max-w-sm">
      <div className="flex items-center space-x-2 text-violet-400">
        <Key size={20} />
        <h3 className="font-semibold text-neutral-200">API Access Required</h3>
      </div>
      <p className="text-xs text-neutral-400 leading-relaxed">
        To use the <strong>Gemini 3 Pro Vision</strong> model for 4K generation, you must connect a valid Google Cloud Project with billing enabled.
      </p>
      
      {error && (
        <div className="flex items-center space-x-2 text-red-400 text-xs bg-red-400/10 p-2 rounded w-full">
            <AlertCircle size={14} />
            <span>{error}</span>
        </div>
      )}

      <div className="flex space-x-3 w-full">
        <button
            onClick={handleConnect}
            className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
        >
            Select API Key
        </button>
        <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors"
            title="Billing Documentation"
        >
            <ExternalLink size={16} />
        </a>
      </div>
    </div>
  );
};