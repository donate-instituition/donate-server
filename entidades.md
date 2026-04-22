# Documento de Entidades, Campos e Relacionamentos  
## Plataforma Mobile de Doações

**Projeto:** Plataforma Mobile de Doações  
**Data:** 22/04/2026  

---

# 1. Introdução

Este documento apresenta as entidades principais do projeto da plataforma mobile de doações, seus respectivos campos e os relacionamentos conceituais entre elas. A modelagem foi pensada para utilização com **MongoDB**, considerando collections independentes, referências por identificadores e alguns relacionamentos polimórficos quando necessário.

O objetivo deste documento é servir como base para:
- modelagem do banco de dados;
- implementação do back-end;
- entendimento do domínio do sistema;
- documentação acadêmica e técnica.

---

# 2. Visão geral da modelagem

A plataforma é composta por entidades relacionadas a:
- identidade e acesso;
- instituições e seus funcionários;
- campanhas;
- doações e pagamentos;
- rastreamento e comprovantes;
- feed social e interações;
- mensagens e notificações;
- moderação e auditoria.

No MongoDB, os relacionamentos serão representados principalmente por campos como `userId`, `institutionId`, `campaignId`, `donationId` e semelhantes, sendo a integridade referencial tratada pela aplicação.

---

# 3. Entidades do projeto

## 3.1. USERS

### Descrição
Representa pessoas que utilizam a plataforma. Pode corresponder a:
- usuário padrão;
- administrador da plataforma;
- funcionário de instituição.

### Collection
`users`

### Campos
- `_id`: ObjectId — identificador único do usuário
- `type`: string — tipo da entidade, por exemplo `PERSON`
- `role`: string — papel do usuário, como `PLATFORM_ADMIN`, `DONOR` ou `INSTITUTION_STAFF`
- `fullName`: string — nome completo
- `email`: string — e-mail do usuário
- `phone`: string — telefone
- `cpf`: string — CPF do usuário padrão
- `passwordHash`: string — hash da senha
- `birthDate`: date — data de nascimento
- `profilePhotoUrl`: string — URL da foto de perfil
- `bio`: string — descrição curta do perfil
- `status`: string — situação da conta, como `ACTIVE`, `SUSPENDED` ou `PENDING_VERIFICATION`
- `isVerified`: boolean — indica se a conta foi verificada
- `settings`: object — preferências do usuário
- `stats`: object — estatísticas agregadas do usuário
- `createdAt`: date — data de criação
- `updatedAt`: date — data da última atualização

### Relacionamentos
- `USERS 1:N INSTITUTION_STAFF_MEMBERSHIPS`
- `USERS 1:N CAMPAIGNS` pelo campo `createdByUserId`
- `USERS 1:N DONATIONS` pelo campo `donorUserId`
- `USERS 1:N MESSAGES` pelo campo `senderUserId`
- `USERS 1:N NOTIFICATIONS`
- `USERS 1:N REPORTS` pelo campo `reporterUserId`
- `USERS 1:N AUDIT_LOGS` pelo campo `actorUserId`
- `USERS 1:N POST_COMMENTS`
- `USERS 1:N POST_REACTIONS`
- `USERS 1:N FOLLOWS` pelo campo `followerUserId`

---

## 3.2. INSTITUTIONS

### Descrição
Representa as instituições que recebem doações e publicam campanhas.

### Collection
`institutions`

### Campos
- `_id`: ObjectId — identificador único da instituição
- `legalName`: string — razão social
- `displayName`: string — nome exibido na plataforma
- `cnpj`: string — CNPJ
- `email`: string — e-mail institucional
- `phone`: string — telefone
- `description`: string — descrição da instituição
- `categoryIds`: ObjectId[] — categorias associadas
- `logoUrl`: string — URL da logo
- `coverPhotoUrl`: string — URL da imagem de capa
- `website`: string — site institucional
- `status`: string — status da instituição, como `PENDING_APPROVAL`, `ACTIVE`, `SUSPENDED`
- `verification`: object — dados de verificação e aprovação
- `address`: object — endereço completo e localização
- `acceptedDonationTypes`: string[] — tipos de doação aceitos
- `pixKey`: string — chave PIX
- `taxReceiptEnabled`: boolean — indica se a instituição emite comprovante
- `stats`: object — métricas agregadas
- `createdAt`: date — data de criação
- `updatedAt`: date — data da última atualização

### Relacionamentos
- `INSTITUTIONS 1:N INSTITUTION_STAFF_MEMBERSHIPS`
- `INSTITUTIONS 1:N CAMPAIGNS`
- `INSTITUTIONS 1:N DONATIONS`
- `INSTITUTIONS 1:N PAYMENTS`
- `INSTITUTIONS 1:N TAX_RECEIPTS`
- `INSTITUTIONS 1:N POSTS` quando `authorType = INSTITUTION`

---

## 3.3. INSTITUTION_STAFF_MEMBERSHIPS

### Descrição
Representa o vínculo entre um usuário e uma instituição, incluindo papel e permissões.

### Collection
`institution_staff_memberships`

### Campos
- `_id`: ObjectId — identificador único do vínculo
- `institutionId`: ObjectId — referência da instituição
- `userId`: ObjectId — referência do usuário
- `role`: string — função dentro da instituição, como `OWNER`, `ADMIN`, `VOLUNTEER`
- `permissions`: string[] — permissões específicas
- `status`: string — situação do vínculo
- `invitedByUserId`: ObjectId — usuário que realizou o convite
- `createdAt`: date — data de criação
- `updatedAt`: date — data da última atualização

### Relacionamentos
- `INSTITUTION_STAFF_MEMBERSHIPS N:1 USERS`
- `INSTITUTION_STAFF_MEMBERSHIPS N:1 INSTITUTIONS`

---

## 3.4. CAMPAIGNS

### Descrição
Representa campanhas de arrecadação criadas por instituições.

### Collection
`campaigns`

### Campos
- `_id`: ObjectId — identificador único da campanha
- `institutionId`: ObjectId — referência da instituição responsável
- `createdByUserId`: ObjectId — usuário que criou a campanha
- `title`: string — título da campanha
- `description`: string — descrição da campanha
- `bannerUrl`: string — imagem principal da campanha
- `status`: string — status da campanha
- `donationTypes`: string[] — tipos de doação aceitos
- `acceptedItems`: object[] — itens aceitos, quando aplicável
- `goal`: object — metas da campanha
- `progress`: object — progresso alcançado
- `visibility`: string — nível de visibilidade
- `startAt`: date — data de início
- `endAt`: date — data de término
- `address`: object — local de recebimento ou referência de endereço
- `tags`: string[] — palavras-chave
- `stats`: object — métricas agregadas
- `createdAt`: date — data de criação
- `updatedAt`: date — data da última atualização

### Relacionamentos
- `CAMPAIGNS N:1 INSTITUTIONS`
- `CAMPAIGNS N:1 USERS` pelo campo `createdByUserId`
- `CAMPAIGNS 1:N DONATIONS`
- `CAMPAIGNS 1:N POSTS`

---

## 3.5. DONATIONS

### Descrição
Representa uma doação realizada por um usuário para uma instituição, podendo ou não estar associada a uma campanha.

### Collection
`donations`

### Campos
- `_id`: ObjectId — identificador único da doação
- `donorUserId`: ObjectId — referência do usuário doador
- `institutionId`: ObjectId — referência da instituição
- `campaignId`: ObjectId — referência da campanha, quando existir
- `type`: string — tipo da doação, como `MONEY` ou `ITEM`
- `status`: string — status atual da doação
- `visibility`: string — visibilidade da doação
- `moneyDonation`: object — dados da doação monetária
- `itemDonation`: object — dados da doação de itens
- `deliveryMode`: string — modo de entrega
- `scheduledAt`: date — data agendada de entrega ou coleta
- `note`: string — observações do doador
- `receiptEligible`: boolean — indica elegibilidade para comprovante
- `proofPhotoUrl`: string — URL de prova, quando existir
- `deliveredAt`: date — data de entrega
- `createdAt`: date — data de criação
- `updatedAt`: date — data da última atualização

### Relacionamentos
- `DONATIONS N:1 USERS` pelo campo `donorUserId`
- `DONATIONS N:1 INSTITUTIONS`
- `DONATIONS N:1 CAMPAIGNS`
- `DONATIONS 1:N DONATION_STATUS_HISTORY`
- `DONATIONS 1:N PAYMENTS`
- `DONATIONS 1:N TRACKING_EVENTS`
- `DONATIONS 1:N DELIVERY_PROOFS`
- `DONATIONS 1:N TAX_RECEIPTS`

---

## 3.6. DONATION_STATUS_HISTORY

### Descrição
Registra a evolução dos status de uma doação.

### Collection
`donation_status_history`

### Campos
- `_id`: ObjectId — identificador único do histórico
- `donationId`: ObjectId — referência da doação
- `fromStatus`: string — status anterior
- `toStatus`: string — novo status
- `changedByUserId`: ObjectId — usuário responsável pela alteração
- `source`: string — origem da alteração, como `SYSTEM`, `DONOR`, `INSTITUTION_STAFF`, `PAYMENT_WEBHOOK`
- `note`: string — observação sobre a alteração
- `createdAt`: date — data da alteração

### Relacionamentos
- `DONATION_STATUS_HISTORY N:1 DONATIONS`
- `DONATION_STATUS_HISTORY N:1 USERS` pelo campo `changedByUserId`

---

## 3.7. PAYMENTS

### Descrição
Representa o pagamento de uma doação monetária.

### Collection
`payments`

### Campos
- `_id`: ObjectId — identificador único do pagamento
- `donationId`: ObjectId — referência da doação
- `donorUserId`: ObjectId — referência do usuário doador
- `institutionId`: ObjectId — referência da instituição
- `gateway`: string — gateway de pagamento utilizado
- `gatewayTransactionId`: string — identificador externo da transação
- `paymentMethod`: string — método de pagamento
- `amount`: float — valor do pagamento
- `currency`: string — moeda
- `status`: string — status do pagamento
- `pix`: object — dados de PIX, quando aplicável
- `gatewayPayload`: object — payload bruto do gateway, quando necessário
- `paidAt`: date — data de confirmação do pagamento
- `refundedAt`: date — data de reembolso, quando houver
- `createdAt`: date — data de criação
- `updatedAt`: date — data da última atualização

### Relacionamentos
- `PAYMENTS N:1 DONATIONS`
- `PAYMENTS N:1 USERS`
- `PAYMENTS N:1 INSTITUTIONS`

---

## 3.8. TRACKING_EVENTS

### Descrição
Registra eventos de rastreamento da doação física.

### Collection
`tracking_events`

### Campos
- `_id`: ObjectId — identificador único do evento
- `donationId`: ObjectId — referência da doação
- `eventType`: string — tipo do evento
- `location`: object — localização geográfica
- `description`: string — descrição do evento
- `actorUserId`: ObjectId — usuário responsável pelo registro
- `photoUrl`: string — foto associada ao evento, quando aplicável
- `createdAt`: date — data do registro

### Relacionamentos
- `TRACKING_EVENTS N:1 DONATIONS`

---

## 3.9. DELIVERY_PROOFS

### Descrição
Representa a comprovação formal da entrega da doação.

### Collection
`delivery_proofs`

### Campos
- `_id`: ObjectId — identificador único da prova
- `donationId`: ObjectId — referência da doação
- `photoUrl`: string — URL da foto de comprovação
- `description`: string — descrição da entrega
- `confirmedByUserId`: ObjectId — usuário que confirmou
- `confirmedAt`: date — data de confirmação
- `metadata`: object — metadados adicionais
- `createdAt`: date — data de criação

### Relacionamentos
- `DELIVERY_PROOFS N:1 DONATIONS`
- `DELIVERY_PROOFS N:1 USERS` pelo campo `confirmedByUserId`

---

## 3.10. TAX_RECEIPTS

### Descrição
Representa comprovantes de doação emitidos para consulta e fins fiscais.

### Collection
`tax_receipts`

### Campos
- `_id`: ObjectId — identificador único do comprovante
- `donationId`: ObjectId — referência da doação
- `donorUserId`: ObjectId — referência do doador
- `institutionId`: ObjectId — referência da instituição
- `receiptNumber`: string — número do comprovante
- `type`: string — tipo do comprovante
- `amount`: float — valor associado
- `issuedAt`: date — data de emissão
- `documentUrl`: string — URL do documento
- `metadata`: object — dados auxiliares
- `year`: int — ano de referência
- `createdAt`: date — data de criação

### Relacionamentos
- `TAX_RECEIPTS N:1 DONATIONS`
- `TAX_RECEIPTS N:1 USERS`
- `TAX_RECEIPTS N:1 INSTITUTIONS`

---

## 3.11. FOLLOWS

### Descrição
Representa o ato de seguir uma instituição, campanha ou eventualmente outro usuário.

### Collection
`follows`

### Campos
- `_id`: ObjectId — identificador único do relacionamento
- `followerUserId`: ObjectId — usuário que está seguindo
- `targetType`: string — tipo do alvo seguido
- `targetId`: ObjectId — identificador do alvo seguido
- `createdAt`: date — data de criação

### Relacionamentos
- `FOLLOWS N:1 USERS` pelo campo `followerUserId`
- relacionamento polimórfico com:
  - `INSTITUTIONS`
  - `CAMPAIGNS`
  - `USERS` opcionalmente

---

## 3.12. POSTS

### Descrição
Representa publicações do feed social.

### Collection
`posts`

### Campos
- `_id`: ObjectId — identificador único do post
- `authorType`: string — tipo do autor
- `authorId`: ObjectId — identificador do autor
- `campaignId`: ObjectId — campanha associada, quando aplicável
- `institutionId`: ObjectId — instituição associada, quando aplicável
- `content`: string — conteúdo textual
- `media`: object[] — mídias vinculadas
- `visibility`: string — nível de visibilidade
- `stats`: object — estatísticas agregadas
- `createdAt`: date — data de criação
- `updatedAt`: date — data da última atualização

### Relacionamentos
- `POSTS N:1 USERS` quando `authorType = USER`
- `POSTS N:1 INSTITUTIONS` quando `authorType = INSTITUTION`
- `POSTS N:1 CAMPAIGNS` opcionalmente
- `POSTS 1:N POST_COMMENTS`
- `POSTS 1:N POST_REACTIONS`

---

## 3.13. POST_COMMENTS

### Descrição
Representa comentários realizados em publicações.

### Collection
`post_comments`

### Campos
- `_id`: ObjectId — identificador único do comentário
- `postId`: ObjectId — referência do post
- `userId`: ObjectId — referência do autor do comentário
- `parentCommentId`: ObjectId — comentário pai, quando for resposta
- `content`: string — conteúdo textual
- `createdAt`: date — data de criação
- `updatedAt`: date — data da última atualização

### Relacionamentos
- `POST_COMMENTS N:1 POSTS`
- `POST_COMMENTS N:1 USERS`
- `POST_COMMENTS N:1 POST_COMMENTS` pelo campo `parentCommentId`

---

## 3.14. POST_REACTIONS

### Descrição
Representa curtidas ou reações em posts.

### Collection
`post_reactions`

### Campos
- `_id`: ObjectId — identificador único da reação
- `postId`: ObjectId — referência do post
- `userId`: ObjectId — referência do usuário
- `type`: string — tipo de reação
- `createdAt`: date — data de criação

### Relacionamentos
- `POST_REACTIONS N:1 POSTS`
- `POST_REACTIONS N:1 USERS`

---

## 3.15. CONVERSATIONS

### Descrição
Representa conversas no módulo de chat.

### Collection
`conversations`

### Campos
- `_id`: ObjectId — identificador único da conversa
- `type`: string — tipo da conversa, como `DIRECT` ou `GROUP`
- `participantIds`: ObjectId[] — participantes da conversa
- `institutionId`: ObjectId — referência institucional, quando houver
- `campaignId`: ObjectId — referência de campanha, quando houver
- `lastMessageAt`: date — data da última mensagem
- `createdAt`: date — data de criação
- `updatedAt`: date — data da última atualização

### Relacionamentos
- `CONVERSATIONS 1:N MESSAGES`

---

## 3.16. MESSAGES

### Descrição
Representa mensagens trocadas nas conversas.

### Collection
`messages`

### Campos
- `_id`: ObjectId — identificador único da mensagem
- `conversationId`: ObjectId — referência da conversa
- `senderUserId`: ObjectId — referência do remetente
- `content`: string — conteúdo da mensagem
- `messageType`: string — tipo da mensagem
- `attachments`: object[] — anexos
- `readBy`: object[] — informações de leitura
- `createdAt`: date — data de criação
- `updatedAt`: date — data da última atualização

### Relacionamentos
- `MESSAGES N:1 CONVERSATIONS`
- `MESSAGES N:1 USERS`

---

## 3.17. NOTIFICATIONS

### Descrição
Representa notificações enviadas aos usuários.

### Collection
`notifications`

### Campos
- `_id`: ObjectId — identificador único da notificação
- `userId`: ObjectId — usuário destinatário
- `type`: string — tipo da notificação
- `title`: string — título
- `body`: string — corpo textual
- `data`: object — dados adicionais
- `readAt`: date — data de leitura
- `createdAt`: date — data de criação

### Relacionamentos
- `NOTIFICATIONS N:1 USERS`

---

## 3.18. REPORTS

### Descrição
Representa denúncias e registros de moderação.

### Collection
`reports`

### Campos
- `_id`: ObjectId — identificador único da denúncia
- `reporterUserId`: ObjectId — usuário denunciante
- `targetType`: string — tipo da entidade denunciada
- `targetId`: ObjectId — entidade denunciada
- `reason`: string — motivo da denúncia
- `description`: string — detalhamento
- `status`: string — situação da denúncia
- `reviewedByUserId`: ObjectId — usuário revisor
- `reviewedAt`: date — data da revisão
- `createdAt`: date — data de criação
- `updatedAt`: date — data da última atualização

### Relacionamentos
- `REPORTS N:1 USERS` pelo campo `reporterUserId`
- relacionamento polimórfico com:
  - `USERS`
  - `INSTITUTIONS`
  - `CAMPAIGNS`
  - `POSTS`
  - `MESSAGES`

---

## 3.19. AUDIT_LOGS

### Descrição
Representa logs de auditoria de ações relevantes no sistema.

### Collection
`audit_logs`

### Campos
- `_id`: ObjectId — identificador único do log
- `actorUserId`: ObjectId — usuário que realizou a ação
- `action`: string — ação executada
- `targetType`: string — tipo da entidade afetada
- `targetId`: ObjectId — entidade afetada
- `metadata`: object — informações adicionais
- `ip`: string — endereço IP
- `userAgent`: string — identificador do cliente
- `createdAt`: date — data do evento

### Relacionamentos
- `AUDIT_LOGS N:1 USERS`
- relacionamento polimórfico com qualquer entidade auditável

---

## 3.20. CATEGORIES

### Descrição
Representa categorias usadas para instituições e itens de doação.

### Collection
`categories`

### Campos
- `_id`: ObjectId — identificador único da categoria
- `type`: string — tipo de categoria
- `name`: string — nome da categoria
- `slug`: string — identificador textual amigável
- `isActive`: boolean — indica se está ativa
- `createdAt`: date — data de criação

### Relacionamentos
- `CATEGORIES N:N INSTITUTIONS` por meio de `categoryIds`
- `CATEGORIES N:N CAMPAIGNS` quando usado como categorização complementar

---

# 4. Resumo geral dos relacionamentos

```text
USERS 1:N INSTITUTION_STAFF_MEMBERSHIPS
INSTITUTIONS 1:N INSTITUTION_STAFF_MEMBERSHIPS

INSTITUTIONS 1:N CAMPAIGNS
USERS 1:N CAMPAIGNS

USERS 1:N DONATIONS
INSTITUTIONS 1:N DONATIONS
CAMPAIGNS 1:N DONATIONS

DONATIONS 1:N DONATION_STATUS_HISTORY
DONATIONS 1:N PAYMENTS
DONATIONS 1:N TRACKING_EVENTS
DONATIONS 1:N DELIVERY_PROOFS
DONATIONS 1:N TAX_RECEIPTS

USERS 1:N FOLLOWS
FOLLOWS N:1 INSTITUTIONS
FOLLOWS N:1 CAMPAIGNS
FOLLOWS N:1 USERS

USERS 1:N POSTS
INSTITUTIONS 1:N POSTS
CAMPAIGNS 1:N POSTS

POSTS 1:N POST_COMMENTS
POSTS 1:N POST_REACTIONS

CONVERSATIONS 1:N MESSAGES
USERS 1:N MESSAGES

USERS 1:N NOTIFICATIONS
USERS 1:N REPORTS
USERS 1:N AUDIT_LOGS