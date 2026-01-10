/**
 * DICAS DO SISTEMA
 * 
 * Este arquivo centraliza todas as dicas do aplicativo.
 * Usado por:
 * - Modal "Dica do Dia" (TipOfTheDay.tsx)
 * - Dicas após respostas da IA (CommandCenter.tsx)
 * 
 * Para adicionar/editar dicas, modifique apenas este arquivo.
 */

export const TIPS = [
    // Funcionalidades Premium e Assinaturas
    "🎁 Quer 30 dias de acesso VIP grátis? Toque no botão 'Indicar Amigos' no seu perfil e compartilhe seu link exclusivo!",
    "💳 Cartão de crédito é mais prático! Cadastre seu cartão e nunca mais se preocupe em pagar sua mensalidade.",
    "📊 Plano Light: 10 comandos de IA por dia. Plano Pro: comandos ilimitados! Faça upgrade no menu 'Planos'.",
    "🔐 Login em 1 segundo! Ative a biometria (impressão digital ou Face ID) na próxima vez que fizer login.",

    // Comandos de Voz e IA
    "💡 Você sabia que não precisa digitar? Toque no microfone e diga: 'Marca o João amanhã às 10h'. Eu preencho a agenda para você!",
    "🚀 Tente dizer tudo de uma vez para ser mais produtivo: 'Cadastra a Ana, marca ela pra terça às 14h e anota que ela já pagou 50 reais no Pix'.",
    "🗣️ Sou treinada para entender sua fala natural. Não precisa falar como robô, fale como se estivesse conversando com uma secretária.",
    "🛑 Atingiu o limite diário da IA? Não se preocupe! Você pode continuar registrando tudo manualmente pelos menus do aplicativo.",

    // Gestão Financeira
    "💰 Anotar despesas é vital! Diga: 'Gastei 50 reais de gasolina' e eu abato isso do seu faturamento diário.",
    "💵 Especifique como recebeu para seu caixa bater certinho! Diga: 'Recebi 100 reais no Dinheiro' ou 'Recebi 200 no Cartão'.",
    "📈 Quer ver seu lucro? Pergunte: 'Quanto eu ganhei hoje?' e eu somo tudo o que você registrou.",
    "📅 O fim do mês não precisa ser estressante. Pergunte 'Faturamento de Dezembro' para ter um panorama completo.",
    "💸 Acesse o menu 'Financeiro' para ver gráficos detalhados de receitas, despesas e lucro do mês.",
    "🔍 Use os filtros na tela Financeiro para ver apenas recebimentos em Pix, Dinheiro ou Cartão.",

    // Agenda e Agendamentos
    "📅 Quer uma visão geral do mês? Acesse o menu 'Agenda' para ver seu calendário completo de compromissos.",
    "📝 Ao agendar, fale o serviço específico (ex: 'Marca o Pedro para troca de fiação') para saber quanto tempo vai levar.",
    "❌ Imprevistos acontecem. Se alguém desistir, apenas diga: 'A Maria cancelou' e eu libero o horário na sua agenda.",
    "🔮 Olhe para o futuro! Pergunte: 'O que eu tenho pra semana que vem?' e prepare-se com antecedência.",
    "☀️ Comece o dia organizado. Ao tomar café, pergunte: 'O que tem pra hoje?' e visualize sua rota.",

    // Clientes
    "🐘 Eu lembro dos seus clientes! Se o cliente já veio antes, basta dizer o primeiro nome que eu encontro o cadastro.",
    "🐘 Se você tem dois clientes com o mesmo nome, lembre-se de chamar cada um de forma diferente pra IA saber quem é",
    "🏆 Descubra quem valoriza seu trabalho. Pergunte: 'Quem foi meu melhor cliente esse mês?'.",
    "👥 Acesse o menu 'Clientes' para ver a lista completa com WhatsApp e histórico de cada um.",
    "👥 Se você tiver dificuldades pra usar as telas, peça à IA: Abra a página de 'Clientes', ou abra a página de 'Agenda'",

    // Vendas e Pagamentos  
    "📝 Registre a venda apenas quando o cliente efetuar o pagamento. Vendas pendentes aparecem separadas no financeiro.",
    "✏️ Esqueceu de anotar na hora? Diga: 'Ontem eu gastei 30 reais na padaria' e eu ajusto a data para você.",
    "🔄 Você pode editar ou excluir lançamentos manuais diretamente no menu 'Financeiro'.",
    "🔄 Registrou algo que não era bem assim? Diga cancelar esse lançamento e eu apago. PS. Isso não da certo pra parcelamentos.",

    // Limitações Conhecidas
    "📅 Posso cadastrar parcelamentos. Diga: 'Repus meu estoque e vou pagar R$ 300,00 em 3 vezes. A primeira é dia 20. Se esquecer o valor, eu pergunto.",
    "⏳ Você pode registrar despesas futuras (agendadas). Diga pra quem, o valor e o dia que você vai pagar.",
    "⏳ Você pode registrar receitas futuras (agendadas). Diga pra quem, o valor e o dia que você vai receber.",
    "⏳ Quando receber uma conta diga: 'O João me devia R$ 100,00 pro dia 20. Ele pagou essa conta hoje'.",

    // Profissões Específicas
    "💅 Conhece uma Manicure? Indique o app! Ela pode agendar a próxima cliente sem parar de fazer a unha da atual, usando apenas a voz.",
    "🌿 Jardineiros adoram este app! É ideal para agendar a manutenção mensal dos clientes recorrentes em segundos.",
    "🚚 Quem faz fretes usa muito nosso sistema! É fácil dizer 'Agendar mudança do Carlos para sábado' na pausa pro café.",
    "📚 Professores particulares podem organizar a agenda dos alunos e saber exatamente quem está devendo a mensalidade.",
    "💪 Indique para um Personal Trainer! Ele pode registrar o pagamento da hora/aula entre um exercício e outro.",
    "🛋️ Trabalha com Higienização de Estofados? O app ajuda a calcular quanto você gastou de produtos químicos e o valor do serviço.",
    "🔧 Você é Marido de Aluguel? O app é sua caixa de ferramentas administrativa. Agende visitas e cobre serviços em um lugar só.",
    "⚡ Este app é perfeito para Eletricistas registrarem o valor das peças compradas falando 'Gastei X em fios' enquanto estão no alto da escada.",
    "👗 Vende Cosméticos ou Roupas porta a porta? Diga 'Vendi 2 perfumes para a Sônia' e nunca mais perca o controle.",
    "🐕 Tem um amigo Dog Walker? Indique o app! Ele pode anotar qual cachorro passeou e quem já pagou enquanto caminha no parque.",
    "🛵 Faz entregas por conta própria? Controle quanto gastou de combustível no dia para saber seu lucro real da diária.",
    "❄️ Conhece um Técnico de Ar Condicionado? No verão a agenda lota! Indique o app para ele não perder nenhum chamado na correria.",
    "💈 Barbeiros usam o app para ver qual cliente corta cabelo toda semana e ofereça um plano mensal.",
    "🚗 Indique para seu Mecânico! Ele pode listar as peças que comprou para o carro falando: 'Comprei óleo e filtro por 150 reais'.",
    "🧠 Profissionais liberais como Psicólogos usam o app para organizar a agenda de pacientes sem precisar de uma recepcionista.",

    // Geral e Engajamento
    "🤝 Organizar a vida financeira traz paz. Se este app te ajuda, compartilhe com um amigo autônomo e ajude ele a crescer também!",
    "💡 Toque na lâmpada no topo da tela para ver todas as dicas disponíveis, uma de cada vez!",
    "📱 Instale o app na tela inicial! No Chrome: Menu → Adicionar à tela inicial. Funciona como app nativo!",
    "🔔 Fique atente às notificações para ver as novidades do app. Se tiver promoções e sorteios aparecerá aqui.",
    "⚙️ Acesse 'Perfil' para ver seu código de indicação, status da assinatura e gerenciar seus dados."
];

/**
 * Retorna uma dica aleatória do array
 */
export function getRandomTip(): string {
    const randomIndex = Math.floor(Math.random() * TIPS.length);
    return TIPS[randomIndex];
}

/**
 * Retorna a dica do dia baseada na data atual
 * Garante que todos os usuários vejam a mesma dica no mesmo dia
 */
export function getTipOfTheDay(): string {
    const today = new Date().getDate();
    const tipIndex = (today - 1) % TIPS.length;
    return TIPS[tipIndex];
}

/**
 * Retorna o índice da dica do dia
 */
export function getTipOfTheDayIndex(): number {
    const today = new Date().getDate();
    return (today - 1) % TIPS.length;
}
