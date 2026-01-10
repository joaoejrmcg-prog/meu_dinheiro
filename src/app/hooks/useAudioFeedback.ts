import { useState, useCallback } from 'react';
// generateAudio removed - voice feature is currently disabled

export function useAudioFeedback() {
    const [isSpeaking, setIsSpeaking] = useState(false);

    const playAudio = useCallback(async (text: string, serverAudioData?: string, forcedInputType?: 'text' | 'voice') => {
        // VOICE DISABLED BY USER REQUEST
        // To re-enable, remove this early return and the comments below.
        return;

        /*
        try {
            setIsSpeaking(true);
            const cacheKey = `audio_cache_${text.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            const cachedAudio = localStorage.getItem(cacheKey);

            let audioToPlay = cachedAudio;
            let shouldCache = false;

            if (!audioToPlay) {
                if (serverAudioData) {
                    audioToPlay = serverAudioData || null;
                    shouldCache = true;
                } else {
                    // Try to generate with OpenAI
                    const generated = await generateAudio(text);
                    if (generated) {
                        audioToPlay = generated;
                        shouldCache = true;
                    } else {
                        // Fallback to Browser TTS (Native PT-BR)
                        console.log("🌐 Using Browser TTS fallback");
                        const utterance = new SpeechSynthesisUtterance(text);
                        utterance.lang = 'pt-BR';
                        utterance.rate = 1.1; // Slightly faster

                        // Find a good PT-BR voice
                        const voices = window.speechSynthesis.getVoices();
                        const ptVoice = voices.find(v => v.lang.includes('pt-BR') || v.lang.includes('pt'));
                        if (ptVoice) utterance.voice = ptVoice || null;

                        window.speechSynthesis.speak(utterance);

                        // Wait for end (approximate since onend is tricky with React updates)
                        await new Promise<void>(resolve => {
                            utterance.onend = () => resolve();
                            // Timeout fallback
                            setTimeout(resolve, (text.length * 100) + 1000);
                        });
                        return; // Exit since we played via browser
                    }
                }
            }

            if (audioToPlay) {
                // PLAY FIRST!
                const audio = new Audio(`data:audio/mp3;base64,${audioToPlay}`);

                // Cache in background (don't await)
                if (shouldCache) {
                    setTimeout(() => {
                        try {
                            localStorage.setItem(cacheKey, audioToPlay!);
                            console.log("💾 Audio cached in background");
                        } catch (e) {
                            console.warn("Storage full, skipping cache");
                        }
                    }, 0);
                }

                await new Promise<void>((resolve) => {
                    audio.onended = () => resolve();
                    audio.play().catch(e => {
                        console.error("Audio play error:", e);
                        resolve();
                    });
                });
            }
        } catch (e) {
            console.error("Error playing system audio:", e);
        } finally {
            setIsSpeaking(false);
        }
        */
    }, []);

    return {
        isSpeaking,
        playAudio
    };
}
