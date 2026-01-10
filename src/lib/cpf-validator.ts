/**
 * CPF Validation Library
 * Funções para validação, formatação e limpeza de CPF
 */

/**
 * Valida CPF usando o algoritmo oficial
 * @param cpf - CPF com ou sem formatação
 * @returns true se válido, false se inválido
 */
export function validateCPF(cpf: string): boolean {
    const cleaned = cleanCPF(cpf);

    // Verifica se tem 11 dígitos
    if (cleaned.length !== 11) return false;

    // Verifica se todos os dígitos são iguais (ex: 111.111.111-11)
    if (/^(\d)\1{10}$/.test(cleaned)) return false;

    // Validação do primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cleaned.charAt(i)) * (10 - i);
    }
    let digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cleaned.charAt(9))) return false;

    // Validação do segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cleaned.charAt(i)) * (11 - i);
    }
    digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cleaned.charAt(10))) return false;

    return true;
}

/**
 * Remove caracteres especiais do CPF
 * @param cpf - CPF formatado ou não
 * @returns CPF apenas com números
 */
export function cleanCPF(cpf: string): string {
    return cpf.replace(/\D/g, '');
}

/**
 * Formata CPF para o padrão XXX.XXX.XXX-XX
 * @param cpf - CPF apenas com números
 * @returns CPF formatado
 */
export function formatCPF(cpf: string): string {
    const cleaned = cleanCPF(cpf);

    if (cleaned.length === 0) return '';
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
    if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;

    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
}

/**
 * Valida e formata CPF de forma segura
 * @param cpf - CPF a ser validado e formatado
 * @returns Objeto com validação e CPF formatado
 */
export function validateAndFormat(cpf: string): { isValid: boolean; formatted: string; cleaned: string } {
    const cleaned = cleanCPF(cpf);
    const isValid = validateCPF(cleaned);
    const formatted = formatCPF(cleaned);

    return { isValid, formatted, cleaned };
}
