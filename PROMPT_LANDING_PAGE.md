# Prompts para Criação da Landing Page - Meu Dinheiro IA

Aqui estão prompts detalhados que você pode usar em diferentes IAs para criar uma Landing Page incrível para o seu projeto.

---

## 1. Prompt para Copywriting (ChatGPT / Claude / DeepSeek)

**Objetivo:** Criar o texto persuasivo (copy) da página.

**Prompt:**
```markdown
Atue como um Copywriter Sênior especializado em Fintechs e produtos SaaS B2C.
Eu preciso criar o conteúdo para a Landing Page do meu aplicativo chamado "Meu Dinheiro IA".

**O Produto:**
É um assistente financeiro pessoal baseado em Inteligência Artificial que funciona via chat (texto e voz). Diferente dos apps tradicionais cheios de menus, abas e formulários complexos, o "Meu Dinheiro IA" permite que o usuário controle suas finanças conversando naturalmente.

**Público-Alvo:**
Pessoas que acham apps de banco complicados, odeiam planilhas de Excel, ou têm preguiça de categorizar gastos manualmente. Pessoas que querem praticidade e rapidez.

**Principais Funcionalidades (Value Props):**
1. **Zero Menus:** Tudo é feito via chat. "Gastei 50 no mercado", "Parcelei a TV em 10x", "Quanto devo pro João?".
2. **Inteligência Real:** Ele entende contextos. Se você diz "Paguei o João", ele sabe que é um empréstimo ou dívida, não uma despesa de mercado.
3. **Comandos de Voz:** Fale enquanto dirige ou caminha. "Anota aí, 30 reais de padaria".
4. **Guardião da Lógica:** Ele valida o que você diz. Se você falar algo ambíguo, ele pergunta para esclarecer.
5. **Gestão Completa:** Controla gastos, receitas, cartões de crédito (com faturas e vencimentos), empréstimos (quem deve a quem), metas e recorrencias (assinaturas).

**Tom de Voz:**
Moderno, direto, levemente futurista (vibe "Cyberpunk Clean"), confiável e empático. Use gatilhos mentais de simplicidade e alívio cognitivo.

**Estrutura da Página Solicitada:**
1. **Headline (H1):** Algo impactante sobre o fim dos menus e planilhas.
2. **Subheadline:** Explicando a proposta de valor em uma frase.
3. **Seção "Como Funciona":** 3 passos simples (Fale -> A IA Entende -> Está Organizado).
4. **Seção de Features:** Destaque para Empréstimos, Parcelamentos e Metas.
5. **Prova Social / Casos de Uso:** Exemplos de diálogos reais (ex: "Quanto sobra do meu salário se eu gastar 200 agora?").
6. **CTA (Call to Action):** Para começar a usar agora.

Por favor, escreva o conteúdo completo para essas seções.
```

---

## 2. Prompt para Design de Interface (Midjourney / DALL-E / Ideogram)

**Objetivo:** Gerar referências visuais ou assets para a página.

**Prompt:**
```text
High-fidelity UI design of a futuristic fintech landing page for a mobile app called "Meu Dinheiro IA". 
Dark mode aesthetic, deep black background (#050505). 
Neon accents in Green (#00ff9d), Purple (#bd00ff), and Cyan (#00f3ff). 
Glowing orb effects in the background, subtle cyber-tech vibe but clean and readable. 
The hero section features a floating smartphone showing a chat interface where a user says "Gastei 50 no almoço" and the AI replies "Anotado em Alimentação ✅". 
Modern typography, glassmorphism cards, sleek buttons with neon glow. 
Professional, premium, high-tech financial assistant atmosphere. --ar 16:9 --v 6.0
```

---

## 3. Prompt para Geração de Código (v0.dev / Bolt / Cursor)

**Objetivo:** Gerar o código React/Tailwind da página.

**Prompt:**
```markdown
Crie uma Landing Page moderna e responsiva para um app financeiro chamado "Meu Dinheiro IA".

**Tech Stack:**
- React (Next.js)
- Tailwind CSS
- Lucide React (para ícones)
- Framer Motion (para animações suaves)

**Estilo Visual (Design System):**
- **Tema:** Dark Mode Profundo ("Cyber Vibe").
- **Background:** #050505 (quase preto).
- **Cores de Destaque:** 
  - Primary: Neon Green (#00ff9d)
  - Secondary: Neon Purple (#bd00ff)
  - Accent: Cyan (#00f3ff)
- **Efeitos:** Use "Glowing Orbs" (círculos de luz desfocados) no fundo para dar profundidade. Use Glassmorphism (fundos translúcidos com blur) nos cartões.

**Estrutura da Página:**

1. **Header:** Logo "Meu Dinheiro IA" (texto com gradiente neon), Links (Funcionalidades, Sobre, Login), Botão CTA "Começar Agora" (com brilho neon).

2. **Hero Section:**
   - H1 Grande: "Sua Vida Financeira, Resolvida em Uma Conversa."
   - Subtítulo: "Esqueça planilhas e menus complexos. Apenas fale com nossa IA e controle gastos, cartões e metas instantaneamente."
   - Botão CTA Principal.
   - **Elemento Visual:** Uma simulação de chat animada ao lado (ou abaixo no mobile). 
     - Mensagem User: "Parcelei uma TV de 3k em 10x"
     - Mensagem AI: "✅ Entendido! TV de R$ 3.000,00 em 10x de R$ 300,00. Primeiro vencimento para quando?"

3. **Features Grid (Bento Grid Style):**
   - Cartões com ícones neon.
   - **Cartão 1 (Voz):** "Comandos de Voz" - Fale enquanto dirige.
   - **Cartão 2 (Empréstimos):** "Controle de Dívidas" - Saiba exatamente quem te deve.
   - **Cartão 3 (Cartões):** "Gestão de Faturas" - Previsão de fechamento e melhor dia de compra.
   - **Cartão 4 (Metas):** "Objetivos Inteligentes" - Acompanhe seu progresso visualmente.

4. **Seção "Por que usar?":**
   - Comparativo: "Outros Apps (Menus infinitos, formulários chatos)" vs "Meu Dinheiro IA (Chat natural, Zero fricção)".

5. **Footer:** Links simples e copyright.

**Comportamento:**
- A página deve ser totalmente responsiva.
- Adicione animações de "fade-in" nos elementos ao rolar a página (scroll reveal).
- O botão CTA deve ter um efeito de "hover" com brilho intenso.
```
