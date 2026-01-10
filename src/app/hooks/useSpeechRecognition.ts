import { useState, useEffect, useCallback } from 'react';

export interface SpeechRecognitionState {
    isListening: boolean;
    transcript: string;
    error: string | null;
    isSupported: boolean;
}

export function useSpeechRecognition() {
    const [state, setState] = useState<SpeechRecognitionState>({
        isListening: false,
        transcript: '',
        error: null,
        isSupported: false
    });

    const [recognition, setRecognition] = useState<any>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).webkitSpeechRecognition) {
            const recognitionInstance = new (window as any).webkitSpeechRecognition();
            recognitionInstance.continuous = false;
            recognitionInstance.interimResults = false;
            recognitionInstance.lang = 'pt-BR';

            recognitionInstance.onstart = () => {
                setState(prev => ({ ...prev, isListening: true, error: null }));
            };

            recognitionInstance.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setState(prev => ({ ...prev, transcript, isListening: false }));
            };

            recognitionInstance.onerror = (event: any) => {
                setState(prev => ({ ...prev, isListening: false, error: event.error }));
            };

            recognitionInstance.onend = () => {
                setState(prev => ({ ...prev, isListening: false }));
            };

            setRecognition(recognitionInstance);
            setState(prev => ({ ...prev, isSupported: true }));

            return () => {
                if (recognitionInstance) {
                    recognitionInstance.abort();
                    recognitionInstance.onend = null;
                    recognitionInstance.onresult = null;
                    recognitionInstance.onerror = null;
                    recognitionInstance.onstart = null;
                }
            };
        } else {
            setState(prev => ({ ...prev, isSupported: false, error: 'Reconhecimento de voz não suportado neste navegador.' }));
        }
    }, []);

    const startListening = useCallback(() => {
        if (recognition) {
            try {
                recognition.start();
            } catch (e) {
                console.error("Erro ao iniciar reconhecimento:", e);
            }
        }
    }, [recognition]);

    const stopListening = useCallback(() => {
        if (recognition) {
            recognition.stop();
        }
    }, [recognition]);

    const resetTranscript = useCallback(() => {
        setState(prev => ({ ...prev, transcript: '' }));
    }, []);

    return {
        ...state,
        startListening,
        stopListening,
        resetTranscript
    };
}
