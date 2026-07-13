# Uai Telecom - Supervisao IA

Painel operacional para supervisao de atendimentos da Uai Telecom. A aplicacao concentra conversas, vendedores, KPIs, aderencia ao script, processos, classificacoes, alertas e insights em uma experiencia unica para gestores, administradores e operadores.

## Recursos

- Dashboard executivo com indicadores e evolucao da qualidade.
- Consulta de conversas e detalhes da auditoria.
- Visao individual do operador com feedbacks e pendencias.
- Cadastro de processos e classificacoes de atendimento.
- Central de alertas com filtros, reincidencias e acoes de coaching.
- Administracao de usuarios e perfis de acesso.
- Configuracao preparada para Blip, OpenAI e PBX via SSH.

Os dados exibidos atualmente sao demonstrativos. As credenciais das integracoes devem ser informadas somente no ambiente de implantacao.

## Desenvolvimento

Requer Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Validacao

```bash
npm run lint
npm run build
npm test
```

O relatorio da ultima verificacao visual esta em [`design-qa.md`](./design-qa.md).
