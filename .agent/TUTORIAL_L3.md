# Tutorial L3 — Crédito e Automação

> **Última Atualização:** 17/01/2026
> **Referência oficial** para os textos do tutorial nível 3

---

## Fluxo Completo

### L3_INTRO
```
Excelente progresso! 💳

Agora vamos dominar o Crédito e Automação:

1️⃣ Débito Automático — Contas que o banco paga sozinho
2️⃣ Compras Parceladas — Crediário e carnês
3️⃣ Cartão de Crédito — Cadastrar seus cartões

Pronto para o próximo desafio?
```
**Botão:** [Continuar]

---

### L3_DA_INTRO
```
🏦 1. Débito Automático

Algumas contas você nem precisa lembrar de pagar — você instruiu o banco a fazer isso sozinho por você.

Exemplos: conta de luz, água, condomínio, IPTU...

Se o banco debita automaticamente, aqui também deve acontecer igual.
Assim seu saldo fica sempre atualizado sem você fazer nada.
```
**Botão:** [Entendi]

---

### L3_DA_EXAMPLE
```
Para cadastrar um débito automático, me diga:
• "Conta de luz de 150 reais todo dia 10, débito automático"
• "Condomínio de 800 reais, débito automático no Itaú"

Eu registro e, quando chegar o dia, o valor sai sozinho da conta.
```
**Botão:** [Continuar]

---

### L3_INSTALLMENT_INTRO
```
🏪 2. Compras Parceladas (Crediário)

Sabe aquela loja que vende em 10x no boleto ou no carnê?
Isso é diferente de cartão de crédito — são parcelas fixas que você paga todo mês.

Exemplo: Comprei uma TV de R$ 2.000 em 10x de R$ 200.
```
**Botão:** [Entendi]

---

### L3_INSTALLMENT_EXAMPLE
```
Para lançar uma compra parcelada, me diga:
• "Comprei TV de 2500 em 10x no carnê das Casas Bahia"
• "Parcelei geladeira em 12x de 150 reais"
• "Comprei um sapato em por 180 reais, dei entrada de 80, e o restante em 2 vezes. A primeira vence 10/02"

Eu crio todas as parcelas automaticamente no seu calendário e te lembro quando chegar a hora.
```
**Botão:** [Continuar]

---

### L3_CARD_INTRO
```
💳 3. Cartão de Crédito
Você usa cartão de crédito?
```
**Botões:** [Sim] / [Não, pular]

---

### L3_CARD_NAME
```
Qual cartão você mais usa?
```
**Botões:** [Nubank] [Itaú] [Inter] [C6 Bank] [Outro]

---

### L3_CARD_DATES (Slot-filling: fecha, vence, limite)
```
Ótimo! Agora preciso saber informações importantes do seu {cardName}:

Me diga 3 coisas:
Qual o dia que a fatura fecha
Qual o dia que o cartão vence
Qual o limite do seu cartão

💡 Exemplo: "Fecha dia 15, vence dia 22 com limite de 8000"
```

---

### L3_CARD_CREATED
```
✅ Criei o cartão {cardName}!
(Fecha dia {closingDay}, vence dia {dueDay}, com limite de {limit})

Esse será seu cartão principal.
Quando você disser "gastei 50 no crédito", vou usar esse cartão.
Se você fizer uma assinatura mensal diga:
"Assinei Netflix por 39,90"
"Vou pagar 49,90 todo mês pelo Spotfy no cartão"
e eu lanço uma cobrança recorrente no cartão pra você.
```
**Botão:** [Continuar]

---

### L3_CARD_OTHER (explicação sobre outros cartões)
```
Se tiver outro cartão, você pode criar a qualquer momento dizendo:
"Agora tenho um novo cartão Nubank"
E eu cadastro pra você.
Mas ele não será seu cartão principal. Então, se quiser lançar nele, é só especificar:
"Gastei 100 no crédito do Nubank"
Em vez de lançar no cartão principal eu lanço nele.
```
**Botão:** [Entendi]

---

### L3_CARD_DISTINCTION
```
💡 Dica importante!

Se você tem conta corrente e cartão no mesmo banco (ex: Itaú), pra eu lançar no cartão de crédito, precisa dizer "no crédito" ou "no cartão" ou "no cartão de crédito" pra eu saber a diferença:

• "Paguei 50 no Itaú" → sai da conta Itaú
• "Paguei 50 no crédito do Itaú" → vai pro cartão Itaú
```
**Botão:** [Entendi]

---

### L3_CARD_TIPS (dicas de uso futuro)
```
Veja como estas informações podem te ajudar no futuro:
**1** – Você pode me perguntar **quanto está sua fatura do mês** e eu te respondo.
**2** – Você pode me perguntar: **Qual o melhor cartão pra eu usar hoje?**
**3** – Você pode me mandar o **PDF da sua fatura** e eu vejo se estão cobrando coisas indevidas que você não lançou.
```
**Botão:** [Entendi]

---

### L3_CARD_PDF (instrução de upload)
```
📄 Você pode me mandar o PDF da sua fatura e eu vejo se estão cobrando coisas indevidas que você não lançou.

Me diga: **"Quero mandar um PDF da minha fatura"** e eu abro o explorador pra você.
```
**Botão:** [Entendi]

---

### L3_DONE
```
🎉 Parabéns! Nível 3 completo!

Agora você pode:
• Cadastrar débitos automáticos
• Lançar compras parceladas
• Usar cartão de crédito com controle total

Continue usando no seu ritmo!
```

---

## Fluxo de Steps

```
L3_INTRO → [Continuar]
    ↓
L3_DA_INTRO → [Entendi]
    ↓
L3_DA_EXAMPLE → [Continuar]
    ↓
L3_INSTALLMENT_INTRO → [Entendi]
    ↓
L3_INSTALLMENT_EXAMPLE → [Continuar]
    ↓
L3_CARD_INTRO → [Sim] / [Não, pular]
    ↓ (Se Sim)
L3_CARD_NAME → [banco] / [Outro]
    ↓
L3_CARD_DATES (texto livre: fecha, vence, limite)
    ↓
L3_CARD_CREATED → [Continuar]
    ↓
L3_CARD_OTHER → [Entendi]
    ↓
L3_CARD_DISTINCTION → [Entendi]
    ↓
L3_CARD_TIPS → [Entendi]
    ↓
L3_CARD_PDF → [Entendi]
    ↓
L3_DONE
```
