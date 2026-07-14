# Uai Telecom - Supervisao IA

Painel operacional para supervisao de atendimentos da Uai Telecom. A aplicacao concentra conversas, vendedores, KPIs, aderencia ao script, processos, classificacoes, alertas e insights em uma experiencia unica para gestores, administradores e operadores.

## Recursos

- Dashboard executivo com indicadores e evolucao da qualidade.
- Consulta de conversas e detalhes da auditoria.
- Visao individual do operador com feedbacks e pendencias.
- Cadastro de processos e classificacoes de atendimento.
- Central de alertas com filtros, reincidencias e acoes de coaching.
- Administracao de usuarios e perfis de acesso.
- Integracao Blip com webhook, sincronizacao de atendentes, tickets e historico.
- Fila de analise OpenAI baseada nos processos e documentos publicados.
- Configuracao preparada para PBX via SSH.

Os dados exibidos atualmente sao demonstrativos. As credenciais das integracoes devem ser informadas somente no ambiente de implantacao.

## Integracao Blip

Variaveis obrigatorias no servidor:

```bash
BLIP_CONTRACT_ID=seu-contract-id
BLIP_BOT_ID=seu-bot-id
BLIP_AUTH_KEY=chave-do-bot
BLIP_WEBHOOK_SECRET=segredo-definido-pela-uai
```

No Portal Blip, abra o bot e consulte **Configuracoes > Informacoes de conexao** para obter o identificador do contrato e a chave de autorizacao. Depois, em **Integracoes > Webhook**, cadastre uma URL publica HTTPS:

```text
https://SEU-DOMINIO/api/integrations/blip/webhook
```

Configure o cabecalho personalizado `x-uai-blip-secret` com o mesmo valor de `BLIP_WEBHOOK_SECRET` e habilite o envio de mensagens e eventos. O bot deve ter permissao de leitura do Desk para os comandos `/attendants`, `/tickets` e `/threads-merged`.

O botao **Sincronizar agora** importa os tickets recentes e seus historicos. O webhook mantem as novas mensagens atualizadas em tempo real. A aplicacao preserva os IDs externos para evitar duplicidade.

Documentacao oficial: [API HTTP da Blip](https://docs.blip.ai/), [webhooks para analise](https://help.blip.ai/hc/en-us/articles/4474381206423-Sending-Data-for-Analysis-via-Webhooks) e [formato das entregas](https://help.blip.ai/hc/en-us/articles/29187147295767-Webhook-Submission-Format).

## Analise OpenAI

Quando a chave estiver disponivel, configure no ambiente seguro:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
```

Cada ticket importado entra como analise pendente. O processador carrega os processos nao arquivados, etapas, criterios, instrucoes e o texto extraido dos documentos antes de enviar a transcricao para a Responses API. Mensagens de audio com uma URL de midia valida sao transcritas antes da avaliacao e o texto volta para o historico do atendimento. O resultado e salvo de forma estruturada para alimentar notas, classificacoes, alertas e aderencia.

Arquivos de texto sao extraidos diretamente. Para PDF, DOCX e outros binarios, configure um bucket Cloudflare R2 com o binding `PROCESS_FILES`.

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
