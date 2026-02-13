
export async function getNextLevelSuggestion(currentLevel: number): Promise<string | null> {
    if (currentLevel === 0) return "\n\n🚀 Ótimo começo! Quer começar a registrar seu dinheiro de verdade?\nDiga **\"Ir para o Nível 1\"** para desbloquear sua Carteira! 🟢";
    if (currentLevel === 1) return "\n\n🚀 Você já domina o básico da Carteira!\n\nPronto para organizar seu dinheiro em Contas Bancárias?\nDiga **\"Ir para o Nível 2\"** para desbloquear Contas e Transferências! 🏦";
    if (currentLevel === 2) return "\n\n🚀 Você já é um mestre da Organização!\n\nPronto para lidar com o perigo do Crédito?\nDiga **\"Ir para o Nível 3\"** para desbloquear Cartões e Faturas! 💳";
    if (currentLevel === 3) return "\n\n🚀 Incrível! Você domina até os Cartões de Crédito!\n\nPronto para o nível final de Planejamento Financeiro?\nDiga **\"Ir para o Nível 4\"** para desbloquear Recorrências e Metas! 🎯";
    return null;
}
