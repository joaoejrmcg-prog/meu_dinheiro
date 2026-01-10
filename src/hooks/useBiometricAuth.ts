import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

/**
 * Hook para autenticação biométrica usando WebAuthn API
 * Suporta: Impressão digital (Android/iOS), Face ID, Touch ID, Windows Hello
 */
export function useBiometricAuth() {
    const [isSupported, setIsSupported] = useState(false);
    const [isEnrolled, setIsEnrolled] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Verificar se navegador suporta WebAuthn
        const supported = window.PublicKeyCredential !== undefined;
        setIsSupported(supported);

        // Verificar se usuário já cadastrou biometria
        const enrolled = localStorage.getItem('biometric_enrolled') === 'true';
        setIsEnrolled(enrolled);
    }, []);

    /**
     * Registrar biometria do usuário após login bem-sucedido
     * Também armazena token de refresh do Supabase para login automático
     */
    const registerBiometric = async (email: string, refreshToken?: string): Promise<boolean> => {

        if (!isSupported) {
            console.log('WebAuthn não suportado neste navegador');
            return false;
        }

        setIsLoading(true);

        try {
            // Gerar challenge aleatório
            const challenge = new Uint8Array(32);
            crypto.getRandomValues(challenge);

            // Criar credencial
            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge: challenge,
                    rp: {
                        name: "Manicure IA",
                        id: window.location.hostname
                    },
                    user: {
                        id: new TextEncoder().encode(email),
                        name: email,
                        displayName: email
                    },
                    pubKeyCredParams: [
                        { alg: -7, type: "public-key" },  // ES256
                        { alg: -257, type: "public-key" } // RS256
                    ],
                    authenticatorSelection: {
                        authenticatorAttachment: "platform", // Usa sensor do dispositivo
                        userVerification: "required" // Exige biometria
                    },
                    timeout: 60000,
                    attestation: "none"
                }
            }) as PublicKeyCredential;

            if (credential) {
                // Salvar credencial ID no localStorage
                const credentialId = btoa(
                    String.fromCharCode(...new Uint8Array(credential.rawId))
                );

                localStorage.setItem('biometric_credential', credentialId);
                localStorage.setItem('biometric_email', email);

                // Salvar refresh token se fornecido
                // Salvar refresh token se fornecido
                if (refreshToken) {
                    localStorage.setItem('biometric_refresh_token', refreshToken);
                }

                localStorage.setItem('biometric_enrolled', 'true');

                setIsEnrolled(true);
                return true;
            }

            return false;
        } catch (error: any) {
            console.error('Erro ao registrar biometria:', error);
            // Usuário cancelou ou erro
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Autenticar usando biometria
     * Retorna dados de login se sucesso: {email, refreshToken}
     */
    const authenticateBiometric = async (): Promise<{ email: string, refreshToken: string | null } | null> => {
        if (!isSupported || !isEnrolled) {
            return null;
        }

        setIsLoading(true);

        try {
            const credentialId = localStorage.getItem('biometric_credential');
            const email = localStorage.getItem('biometric_email');
            const refreshToken = localStorage.getItem('biometric_refresh_token');

            if (!credentialId || !email) {
                return null;
            }

            // Decodificar credential ID
            const rawCredentialId = Uint8Array.from(atob(credentialId), c => c.charCodeAt(0));

            // Gerar challenge
            const challenge = new Uint8Array(32);
            crypto.getRandomValues(challenge);

            // Solicitar autenticação
            const assertion = await navigator.credentials.get({
                publicKey: {
                    challenge: challenge,
                    rpId: window.location.hostname,
                    allowCredentials: [{
                        id: rawCredentialId,
                        type: 'public-key',
                        transports: ['internal'] // Sensor do dispositivo
                    }],
                    userVerification: "required",
                    timeout: 60000
                }
            });

            if (assertion) {
                // Biometria validada! Retornar dados
                return { email, refreshToken };
            }

            return null;
        } catch (error: any) {
            console.error('Erro na autenticação biométrica:', error);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Remover cadastro de biometria
     */
    const removeBiometric = () => {
        localStorage.removeItem('biometric_credential');
        localStorage.removeItem('biometric_email');
        localStorage.removeItem('biometric_refresh_token');
        localStorage.removeItem('biometric_enrolled');
        setIsEnrolled(false);
    };

    /**
     * Atualizar apenas o token de refresh (usado após login com senha)
     */
    const updateBiometricToken = (refreshToken: string) => {
        if (isEnrolled) {
            localStorage.setItem('biometric_refresh_token', refreshToken);
        }
    };

    return {
        isSupported,
        isEnrolled,
        isLoading,
        registerBiometric,
        authenticateBiometric,
        removeBiometric,
        updateBiometricToken
    };
}
