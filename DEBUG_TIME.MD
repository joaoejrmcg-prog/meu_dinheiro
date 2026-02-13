
Relatório de Lentidão (sem alterar código)
Fiz uma análise estática do projeto + artefatos de build em .next. Não fiz nenhuma modificação.

Resumo executivo
A lentidão não é só “porque o sistema é grande”. O tamanho pesa, mas existem gargalos reais e evitáveis hoje.

Evidências objetivas

Existem 17 páginas e 14 são client (use client) em page.tsx.
O app carrega um bloco comum de JS de cerca de 284.4 KB em praticamente todas as rotas (chunks do layout global em 049660711e35b726.js, adf357f77a94a28f.js, 4df7314963abe45b.js, a9c74e40b3eeb18b.js).
Peso por rota (entry JS aproximado):
/dashboard/page: ~645.9 KB
/page (inicial): ~377.4 KB
/financial/page: ~319.3 KB
/planning/page: ~318.3 KB
Há 115 ocorrências de supabase.auth.getUser() nas actions e 32 de createServerClient() em src/app/actions.
Principais gargalos encontrados

Delay artificial de 1 segundo na tela inicial.
CommandCenter.tsx (line 69)
Isso sozinho já adiciona latência perceptível no carregamento da home.
Dupla validação de autenticação + tela bloqueada.
Middleware já valida usuário em middleware.ts (line 32).
Layout cliente valida de novo e mantém spinner até resolver em ClientLayout.tsx (line 28) e ClientLayout.tsx (line 98).
O layout global sempre monta componente cliente em layout.tsx (line 64).
Componentes globais com consultas no mount de todas as telas privadas.
Header busca usuário/perfil: Header.tsx (line 20).
Sidebar busca usuário/nível/admin: Sidebar.tsx (line 32).
NotificationBell busca 2 tabelas + abre 2 canais realtime: NotificationBell.tsx (line 25), NotificationBell.tsx (line 88), NotificationBell.tsx (line 100).
TermsModal roda checagem de termos no mount: TermsModal.tsx (line 36).
Reprocessamento pesado de saldo ao abrir telas.
Dashboard chama recálculo antes de carregar dados: page.tsx (line 65).
Assets também: page.tsx (line 36).
O recálculo percorre contas e consulta movimentos por conta (loop N+1): assets.ts (line 722), assets.ts (line 735), assets.ts (line 740).
Muitas chamadas por tela (hidrata primeiro, busca depois).
Dashboard dispara várias actions em paralelo: page.tsx (line 67).
Financial idem: page.tsx (line 53).
Home também soma várias chamadas em paralelo: page.tsx (line 22), CommandCenter.tsx (line 71), useCommandCenterLogic.ts (line 138), useCommandCenterLogic.ts (line 145).
Conclusão

Parte da lentidão é esperada pelo volume funcional e uso intenso de páginas client-side.
Mas há gargalos concretos que não são “normais”, principalmente:
espera artificial de 1s,
duplicação de validação/auth,
carga global excessiva no layout,
recálculo pesado em toda abertura de tela.
Portanto, existe sim “algo errado/otimizável”, além do tamanho do projeto.

