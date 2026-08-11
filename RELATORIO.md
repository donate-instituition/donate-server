# donate-server — Relatório do que está implementado

> Referência de apoio à monografia, gerada a partir de auditoria direta do
> código em 2026-08-11. Para a visão do sistema como um todo (os 4
> repositórios juntos), ver `donate-infra/RELATORIO-TCC.md`.

## O que é este repositório

API principal do EloDoar: NestJS + MongoDB (Mongoose) + Redis + RabbitMQ +
Socket.IO. Atende toda requisição HTTP/WebSocket síncrona do app; tudo que
é assíncrono (processar pagamento, gerar PDF, enviar push/e-mail) é
publicado numa fila e processado pelo repositório irmão `donate-workers`.

## Modelo de dados — 25 domínios

`users`, `institutions`, `institution-staff-memberships`, `categories`,
`campaigns`, `donations`, `donation-status-history`, `payments`,
`delivery-proofs`, `tax-receipts`, `tracking-events`, `posts`,
`post-comments`, `post-reactions`, `conversations`, `messages`,
`notifications`, `follows`, `reports`, `audit-logs`, `app-settings`,
`support-faqs`, `terms`, `error-logs`. Coleções MongoDB sem chave
estrangeira imposta pelo banco — relações são por `ObjectId` referenciado
manualmente no código (`entidades.md` e
`docs/diagrama-entidade-relacionamento.md` documentam boa parte disso, mas
estão desatualizados — ver ressalvas no fim).

### Entidades centrais

- **User** — `roles: [{name, grantedAt, grantedBy}]` (multi-papel com
  trilha de auditoria, não um campo único), `googleId?` (vínculo com
  Google Sign-In), `passwordHash`, `pushTokens[]`, `status`, `isVerified`,
  `settings.notifications: {donations, campaigns, conversations,
  emailDigestEnabled}` (4 preferências independentes), `settings.
  preferredRole`, `stats`.
- **Institution** — `cnpj` (único), `status` (fila de aprovação
  administrativa), `verification`, `stripeConnectAccountId` +
  `stripeConnect` (status detalhado da conta Connect), `stats`.
- **Campaign** — `goal: {moneyTarget, itemsTarget}`, `progress:
  {moneyRaised, itemsRaised}`, `status` (DRAFT→PUBLISHED→FINISHED/…),
  `stats`.
- **Conversation** / **Message** — chat real e persistido (não é mock):
  `Conversation` guarda participantes/instituição/campanha;
  `Message` (coleção própria) guarda conteúdo, anexos e `readBy`.
- **Notification** — `type` (`DONATION_STATUS_UPDATED`, `NEW_FOLLOWER`,
  `NEW_MESSAGE`, `CAMPAIGN_UPDATE`, `CAMPAIGN_GOAL_REACHED`), `data` livre.

## Superfície de API — 25 controllers + 1 gateway WebSocket

Autenticação JWT Bearer (access token curto + refresh token); rotas
`@Public()` não exigem token; rotas `@Roles(PLATFORM_ADMIN)` (ou
`INSTITUTION_STAFF`) exigem o papel correspondente. Não existe um módulo
"admin" único — capacidades administrativas ficam distribuídas nos
controllers de domínio.

| Domínio | O que expõe |
|---|---|
| `auth` | login/senha, **Google Sign-In** (`POST auth/google` + `POST auth/google/onboarding`), registro, ativação de conta por e-mail, esqueci minha senha (código por e-mail), refresh de sessão, `PATCH auth/me/settings` (papel preferido **e** preferências de notificação por categoria) |
| `users` | CRUD, registro/remoção de push token, detalhe administrativo |
| `institutions` | leitura pública, fila de aprovação admin (`admin/pending`, `approve`, `reject`), configuração de conta Stripe Connect |
| `institution-staff-memberships` | vínculo funcionário↔instituição, papel (OWNER/staff), listagem de equipe |
| `campaigns` | CRUD, publicação, curtir/comentar/compartilhar (upload de capa migrou para `uploads`) |
| `donations` | criação, histórico do doador e da instituição |
| `payments` | criação/confirmação de PaymentIntent Stripe, cancelamento de assinatura, config pública, **webhook do Stripe** (fonte única de verdade sobre status de pagamento) |
| `tax-receipts` | CRUD + download de PDF (token HMAC na query string; o binário é lido do S3 com as credenciais do próprio servidor e devolvido via `pipe()` na resposta — nunca um redirect para URL assinada do S3) |
| `uploads` | módulo genérico de upload em duas etapas (`POST /uploads` → grava em `temp/`, `POST /uploads/:id/confirm` → move para a chave final `public/`/`private/`), usado por avatar, logo/capa de instituição, capa de campanha, mídia de post, comprovante de prestação de contas; ver seção "Armazenamento de objetos" |
| `conversations` / `messages` | chat |
| `notifications` | inbox in-app, marcar como lida |
| `posts` / `post-comments` / `post-reactions` | feed, curtidas, comentários, compartilhamento |
| `follows` | seguir usuário/instituição/campanha |
| `categories`, `delivery-proofs`, `donation-status-history`, `tracking-events`, `reports`, `audit-logs` | CRUD de apoio (upload de comprovante de `delivery-proofs` migrou para `uploads`) |
| `app-settings` | configuração dinâmica, só admin |
| `support-faqs` | FAQ de suporte (pública para leitura) |
| `terms` | termos de uso versionados + aceite |

## Chat em tempo real

`ConversationsGateway` — Socket.IO real, namespace `/chat`, autentica o
socket por JWT na conexão (`auth.token`, query ou header), coloca cada
usuário numa room própria (`user:<id>`), emite `conversationUpdated`,
`messageCreated`, `unreadUpdated`. Não é um placeholder — está ligado ao
fluxo real de `conversations.service.ts`.

## Cache (Redis)

Cache-aside de feed/campanhas/perfil de instituição com invalidação por
versão de lista, rate limiting distribuído (substituiu limite em memória
local, que não escalava entre instâncias), sessão/código de verificação de
"esqueci minha senha", idempotência de requisições mutáveis (header
`Idempotency-Key`), locks distribuídos onde necessário. Local via Docker
(`donate-infra`); pronto para apontar para Upstash Redis em produção só
trocando variável de ambiente.

## Armazenamento de objetos (S3)

Bucket `elodoar-storage-dev` (Terraform em `donate-infra`), driver
configurável (`OBJECT_STORAGE_DRIVER=s3|local`). Hierarquia de chaves fixa,
com `public/` (avatar, logo/capa de instituição, capa de campanha, mídia de
post) e `private/` (documento de usuário/instituição, relatório de
prestação de contas, comprovante por campanha, recibo/anexo por doação),
mais `temp/` para uploads ainda não confirmados.

Fluxo em duas etapas via módulo `uploads` (`src/uploads/`): o cliente sobe
o arquivo para `temp/{uploadId}/`, e só quando a entidade dona é de fato
conhecida (campanha criada, post salvo, usuário autenticado) o backend
"confirma" — copia para a chave final e apaga o temporário
(`ObjectStorageService.moveObject`, `CopyObjectCommand` + `DeleteObjectCommand`
no driver S3). Cada categoria de upload (`UploadCategory`) tem sua própria
checagem de permissão (dono do recurso para categorias de usuário, staff
ativo da instituição para categorias de instituição/campanha) antes de
autorizar a confirmação. Chave privada só é lida por uma rota autenticada
que resolve o dono a partir do próprio prefixo da chave
(`private/users/<id>/...`, `private/campaigns/<id>/proofs/...`, etc.) e
nunca é servida por link direto.

O recibo fiscal (gerado pelo `donate-workers`) segue o mesmo padrão de
segurança mas por um caminho mais direto: em vez de devolver uma URL
assinada do S3 (que expõe o domínio do bucket ao cliente), a rota
`GET /tax-receipts/:id/pdf` lê o objeto com as credenciais do próprio
servidor (`ObjectStorageService.getObjectStream`) e faz `pipe()` direto na
resposta HTTP — o cliente nunca vê `*.amazonaws.com` em lugar nenhum da
cadeia de requisição, mesmo que o driver seja `s3`.

## Filas e resiliência

Todo `NotificationsService.create()`/receita fiscal/e-mail publica numa
fila RabbitMQ consumida pelo `donate-workers` — nada disso roda
sincronamente dentro de uma requisição HTTP. Retry exponencial com jitter
e dead-letter queue (`<fila>.dlq`) são responsabilidade do lado
`donate-workers`, mas a publicação (e o desenho de idempotência das
mensagens) é feita aqui.

## Trabalho mais recente (sessão atual)

1. **Login com Google** — `google-auth-library` para verificar o ID token,
   vínculo automático se o e-mail já existir na base, criação de conta
   pendente + ticket assinado de 15 minutos (`google-onboarding-token.ts`,
   mesmo padrão do token de ativação de conta) para completar o cadastro
   (CPF, data de nascimento, telefone, senha opcional, tipo de conta)
   antes de qualquer sessão real ser emitida. Instituição criada via
   Google passa pela mesma fila de aprovação administrativa que uma
   instituição cadastrada normalmente.
2. **Preferências de notificação por categoria** — `User.settings.
   notifications` deixou de ser um par genérico `{push, email}` e passou a
   ter 4 campos independentes (`donations`, `campaigns`, `conversations`,
   `emailDigestEnabled`). Endpoint `PATCH auth/me/settings` passou a
   aceitar tanto `preferredRole` quanto `notifications` (antes só aceitava
   o primeiro). Script de migração
   (`scripts/backfill-notification-settings.ts`) para usuários já
   existentes.
3. Foto de perfil do Google usada como preenchimento automático **apenas
   na primeira vez** — nunca sobrescreve uma foto que o usuário já tenha
   escolhido manualmente (`toSessionUser` agora devolve `profilePhotoUrl`
   e `notificationSettings` na sessão).
4. **Persistência real no S3** — módulo `uploads` novo (upload genérico em
   duas etapas, chave hierárquica `public/`/`private/`/`temp/`), substituindo
   as rotas de upload ad-hoc que existiam em `campaigns` e `delivery-proofs`
   (cada uma com sua própria cópia de validação de tipo/tamanho e sem
   vínculo automático com a entidade). Recibo fiscal passou de "redirect
   para URL assinada do S3" para "stream do binário através do próprio
   servidor" — o domínio do bucket deixou de ser exposto ao cliente em
   qualquer download de PDF.

## Ressalvas sobre a documentação já existente no repositório

- `entidades.md` descreve `User.role` como campo único — hoje é `roles:
  []`, multi-papel com trilha de auditoria. Também não cobre `app-settings`,
  `support-faqs`, `terms` e `error-logs` (adicionados depois da última
  atualização do documento).
- `docs/diagrama-entidade-relacionamento.md` está razoavelmente alinhado
  para as entidades que cobre, mas também não menciona esses 4 domínios.
- Nenhum dos dois documentos foi alterado — este relatório é um arquivo
  novo e independente.
