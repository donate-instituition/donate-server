# Documento de Entidades, Campos e Relacionamentos  
## Plataforma Mobile de Doações

**Projeto:** Plataforma Mobile de Doações  
**Data:** 22/04/2026  

---

# 1. Introdução

Este documento apresenta as entidades principais do projeto da plataforma mobile de doações, seus respectivos campos, estruturas internas e relacionamentos conceituais. A modelagem foi pensada para utilização com **MongoDB**, considerando collections independentes, referências por identificadores e alguns relacionamentos polimórficos quando necessário.

O objetivo deste documento é servir como base para:
- modelagem do banco de dados;
- implementação do back-end;
- entendimento do domínio do sistema;
- documentação acadêmica e técnica.

---

# 2. Convenções utilizadas

## 2.1. Tipos
- `ObjectId`: identificador MongoDB
- `string`: texto
- `boolean`: verdadeiro ou falso
- `date`: data/hora
- `int`: número inteiro
- `number`: número decimal
- `object`: objeto composto
- `object[]`: lista de objetos
- `enum`: valor textual restrito a uma lista fixa
- `enum[]`: lista de valores restritos

## 2.2. Obrigatoriedade
- **Obrigatório: sim** → o campo deve existir no cadastro principal da entidade
- **Obrigatório: não** → o campo é opcional ou depende do contexto

## 2.3. Observação sobre MongoDB
Como o banco do projeto é MongoDB, os relacionamentos serão tratados principalmente por referências entre collections, utilizando campos como:
- `userId`
- `institutionId`
- `campaignId`
- `donationId`

A integridade referencial será responsabilidade da aplicação.

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
  - obrigatório: sim

- `type`: enum — tipo da entidade de usuário  
  - obrigatório: sim
  - valores possíveis:
    - `PERSON`

- `role`: enum — papel do usuário na plataforma  
  - obrigatório: sim
  - valores possíveis:
    - `PLATFORM_ADMIN` — administrador da plataforma
    - `DONOR` — usuário padrão doador
    - `INSTITUTION_STAFF` — funcionário de instituição

- `fullName`: string — nome completo  
  - obrigatório: sim

- `email`: string — e-mail do usuário  
  - obrigatório: sim

- `phone`: string — telefone do usuário  
  - obrigatório: não

- `cpf`: string — CPF do usuário  
  - obrigatório: não
  - observação: aplicável principalmente ao usuário padrão

- `passwordHash`: string — hash da senha  
  - obrigatório: sim

- `birthDate`: date — data de nascimento  
  - obrigatório: não

- `profilePhotoUrl`: string — URL da foto de perfil  
  - obrigatório: não

- `bio`: string — descrição curta do perfil  
  - obrigatório: não

- `status`: enum — situação da conta  
  - obrigatório: sim
  - valores possíveis:
    - `ACTIVE`
    - `PENDING_VERIFICATION`
    - `SUSPENDED`
    - `DELETED`

- `isVerified`: boolean — indica se a conta foi verificada  
  - obrigatório: sim

- `settings`: object — preferências do usuário  
  - obrigatório: não
  - estrutura:
    - `privateProfile`: boolean — indica se o perfil é privado
    - `allowMessagesFrom`: enum — define quem pode enviar mensagens
      - `EVERYONE`
      - `FOLLOWING`
      - `NONE`
    - `notifications`: object — preferências de notificação
      - `push`: boolean — ativa notificações push
      - `email`: boolean — ativa notificações por e-mail

- `stats`: object — métricas agregadas do usuário  
  - obrigatório: não
  - estrutura:
    - `totalDonatedAmount`: number — valor total já doado
    - `totalDonationsCount`: int — quantidade de doações realizadas
    - `followingInstitutionsCount`: int — quantidade de instituições seguidas
    - `followingCampaignsCount`: int — quantidade de campanhas seguidas

- `createdAt`: date — data de criação  
  - obrigatório: sim

- `updatedAt`: date — data da última atualização  
  - obrigatório: sim

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
  - obrigatório: sim

- `legalName`: string — razão social  
  - obrigatório: sim

- `displayName`: string — nome exibido na plataforma  
  - obrigatório: sim

- `cnpj`: string — CNPJ  
  - obrigatório: sim

- `email`: string — e-mail institucional  
  - obrigatório: sim

- `phone`: string — telefone  
  - obrigatório: não

- `description`: string — descrição da instituição  
  - obrigatório: não

- `categoryIds`: ObjectId[] — lista de categorias associadas  
  - obrigatório: não

- `logoUrl`: string — URL da logo  
  - obrigatório: não

- `coverPhotoUrl`: string — URL da imagem de capa  
  - obrigatório: não

- `website`: string — site institucional  
  - obrigatório: não

- `status`: enum — situação da instituição  
  - obrigatório: sim
  - valores possíveis:
    - `PENDING_APPROVAL`
    - `ACTIVE`
    - `SUSPENDED`
    - `REJECTED`

- `verification`: object — dados de validação da instituição  
  - obrigatório: não
  - estrutura:
    - `isVerified`: boolean — indica se foi verificada
    - `verifiedAt`: date — data da verificação
    - `verifiedByUserId`: ObjectId — administrador responsável pela verificação

- `address`: object — endereço e geolocalização  
  - obrigatório: não
  - estrutura:
    - `street`: string
    - `number`: string
    - `district`: string
    - `city`: string
    - `state`: string
    - `zipCode`: string
    - `country`: string
    - `location`: object
      - `type`: string — normalmente `Point`
      - `coordinates`: number[] — longitude e latitude

- `acceptedDonationTypes`: enum[] — tipos de doação aceitos  
  - obrigatório: não
  - valores possíveis:
    - `MONEY`
    - `CLOTHES`
    - `FOOD`
    - `TOYS`
    - `HYGIENE`

- `pixKey`: string — chave PIX  
  - obrigatório: não

- `taxReceiptEnabled`: boolean — indica se a instituição pode emitir comprovantes  
  - obrigatório: sim

- `stats`: object — métricas agregadas da instituição  
  - obrigatório: não
  - estrutura:
    - `followersCount`: int
    - `campaignsCount`: int
    - `receivedDonationsCount`: int
    - `receivedAmount`: number

- `createdAt`: date — data de criação  
  - obrigatório: sim

- `updatedAt`: date — data da última atualização  
  - obrigatório: sim

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
  - obrigatório: sim

- `institutionId`: ObjectId — referência da instituição  
  - obrigatório: sim

- `userId`: ObjectId — referência do usuário  
  - obrigatório: sim

- `role`: enum — função dentro da instituição  
  - obrigatório: sim
  - valores possíveis:
    - `OWNER`
    - `ADMIN`
    - `MANAGER`
    - `VOLUNTEER`
    - `DELIVERY_OPERATOR`

- `permissions`: string[] — permissões específicas do vínculo  
  - obrigatório: não
  - exemplos:
    - `CREATE_CAMPAIGN`
    - `EDIT_CAMPAIGN`
    - `VIEW_DONATIONS`
    - `MANAGE_STAFF`
    - `GENERATE_RECEIPTS`

- `status`: enum — situação do vínculo  
  - obrigatório: sim
  - valores possíveis:
    - `ACTIVE`
    - `INVITED`
    - `REMOVED`

- `invitedByUserId`: ObjectId — usuário que convidou  
  - obrigatório: não

- `createdAt`: date — data de criação  
  - obrigatório: sim

- `updatedAt`: date — data da última atualização  
  - obrigatório: sim

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
  - obrigatório: sim

- `institutionId`: ObjectId — referência da instituição responsável  
  - obrigatório: sim

- `createdByUserId`: ObjectId — usuário que criou a campanha  
  - obrigatório: sim

- `title`: string — título da campanha  
  - obrigatório: sim

- `description`: string — descrição da campanha  
  - obrigatório: não

- `bannerUrl`: string — imagem principal da campanha  
  - obrigatório: não

- `status`: enum — status da campanha  
  - obrigatório: sim
  - valores possíveis:
    - `DRAFT`
    - `PUBLISHED`
    - `PAUSED`
    - `FINISHED`
    - `CANCELED`

- `donationTypes`: enum[] — tipos de doação aceitos na campanha  
  - obrigatório: sim
  - valores possíveis:
    - `MONEY`
    - `ITEM`

- `acceptedItems`: object[] — lista de itens aceitos  
  - obrigatório: não
  - observação: aplicável principalmente quando `donationTypes` inclui `ITEM`
  - estrutura de cada item:
    - `category`: enum
      - `CLOTHES`
      - `FOOD`
      - `HYGIENE`
      - `TOYS`
      - `OTHER`
    - `name`: string
    - `description`: string

- `goal`: object — metas da campanha  
  - obrigatório: não
  - estrutura:
    - `moneyTarget`: number — meta financeira
    - `itemsTarget`: int — meta de quantidade de itens

- `progress`: object — progresso atual  
  - obrigatório: não
  - estrutura:
    - `moneyRaised`: number
    - `itemsRaised`: int

- `visibility`: enum — visibilidade da campanha  
  - obrigatório: sim
  - valores possíveis:
    - `PUBLIC`
    - `FOLLOWERS_ONLY`

- `startAt`: date — data de início  
  - obrigatório: não

- `endAt`: date — data de término  
  - obrigatório: não

- `address`: object — referência de endereço da campanha  
  - obrigatório: não
  - estrutura:
    - `sameAsInstitution`: boolean — indica se usa o endereço da instituição
    - `street`: string
    - `number`: string
    - `district`: string
    - `city`: string
    - `state`: string
    - `zipCode`: string
    - `country`: string

- `tags`: string[] — palavras-chave  
  - obrigatório: não

- `stats`: object — métricas agregadas  
  - obrigatório: não
  - estrutura:
    - `followersCount`: int
    - `donationsCount`: int
    - `postsCount`: int

- `createdAt`: date — data de criação  
  - obrigatório: sim

- `updatedAt`: date — data da última atualização  
  - obrigatório: sim

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
  - obrigatório: sim

- `donorUserId`: ObjectId — referência do usuário doador  
  - obrigatório: sim

- `institutionId`: ObjectId — referência da instituição  
  - obrigatório: sim

- `campaignId`: ObjectId — referência da campanha  
  - obrigatório: não
  - observação: pode ser nulo em doação direta para a instituição

- `type`: enum — tipo da doação  
  - obrigatório: sim
  - valores possíveis:
    - `MONEY`
    - `ITEM`

- `status`: enum — status atual da doação  
  - obrigatório: sim
  - valores possíveis:
    - `CREATED`
    - `PENDING_PAYMENT`
    - `PAID`
    - `SCHEDULED_PICKUP`
    - `IN_TRANSIT`
    - `DELIVERED`
    - `CANCELED`
    - `FAILED`

- `visibility`: enum — visibilidade da doação  
  - obrigatório: sim
  - valores possíveis:
    - `PUBLIC`
    - `PRIVATE`
    - `ANONYMOUS_PUBLIC`

- `moneyDonation`: object — dados da doação monetária  
  - obrigatório: não
  - observação: usado quando `type = MONEY`
  - estrutura:
    - `amount`: number — valor da doação
    - `currency`: string — moeda, por exemplo `BRL`

- `itemDonation`: object — dados da doação de itens  
  - obrigatório: não
  - observação: usado quando `type = ITEM`
  - estrutura:
    - `items`: object[] — itens doados
      - `category`: enum
        - `CLOTHES`
        - `FOOD`
        - `HYGIENE`
        - `TOYS`
        - `OTHER`
      - `name`: string
      - `quantity`: int
      - `unit`: enum
        - `UNIT`
        - `KG`
        - `LITER`
        - `BOX`
      - `condition`: enum
        - `NEW`
        - `USED_GOOD`
        - `USED_ACCEPTABLE`
    - `estimatedValue`: number — valor estimado total dos itens

- `deliveryMode`: enum — forma de entrega  
  - obrigatório: sim
  - valores possíveis:
    - `INSTANT_ONLINE`
    - `DROP_OFF`
    - `PICKUP`
    - `SHIPPING`

- `scheduledAt`: date — data agendada de entrega ou coleta  
  - obrigatório: não

- `note`: string — observações do doador  
  - obrigatório: não

- `receiptEligible`: boolean — indica elegibilidade para comprovante  
  - obrigatório: sim

- `proofPhotoUrl`: string — URL da foto de prova  
  - obrigatório: não

- `deliveredAt`: date — data de entrega  
  - obrigatório: não

- `createdAt`: date — data de criação  
  - obrigatório: sim

- `updatedAt`: date — data da última atualização  
  - obrigatório: sim

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
  - obrigatório: sim

- `donationId`: ObjectId — referência da doação  
  - obrigatório: sim

- `fromStatus`: enum — status anterior  
  - obrigatório: não
  - valores possíveis:
    - `CREATED`
    - `PENDING_PAYMENT`
    - `PAID`
    - `SCHEDULED_PICKUP`
    - `IN_TRANSIT`
    - `DELIVERED`
    - `CANCELED`
    - `FAILED`

- `toStatus`: enum — novo status  
  - obrigatório: sim
  - valores possíveis:
    - `CREATED`
    - `PENDING_PAYMENT`
    - `PAID`
    - `SCHEDULED_PICKUP`
    - `IN_TRANSIT`
    - `DELIVERED`
    - `CANCELED`
    - `FAILED`

- `changedByUserId`: ObjectId — usuário responsável  
  - obrigatório: não

- `source`: enum — origem da alteração  
  - obrigatório: sim
  - valores possíveis:
    - `SYSTEM`
    - `DONOR`
    - `INSTITUTION_STAFF`
    - `PAYMENT_WEBHOOK`

- `note`: string — observação sobre a alteração  
  - obrigatório: não

- `createdAt`: date — data da alteração  
  - obrigatório: sim

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
  - obrigatório: sim

- `donationId`: ObjectId — referência da doação  
  - obrigatório: sim

- `donorUserId`: ObjectId — referência do usuário doador  
  - obrigatório: sim

- `institutionId`: ObjectId — referência da instituição  
  - obrigatório: sim

- `gateway`: enum — provedor de pagamento  
  - obrigatório: sim
  - valores possíveis:
    - `STRIPE`
    - `MERCADO_PAGO`
    - `PAGSEGURO`
    - `IUGU`

- `gatewayTransactionId`: string — identificador externo da transação  
  - obrigatório: não

- `paymentMethod`: enum — método de pagamento  
  - obrigatório: sim
  - valores possíveis:
    - `PIX`
    - `CREDIT_CARD`
    - `DEBIT_CARD`
    - `BOLETO`

- `amount`: number — valor do pagamento  
  - obrigatório: sim

- `currency`: string — moeda  
  - obrigatório: sim

- `status`: enum — status do pagamento  
  - obrigatório: sim
  - valores possíveis:
    - `PENDING`
    - `AUTHORIZED`
    - `PAID`
    - `REFUNDED`
    - `FAILED`
    - `CANCELED`

- `pix`: object — dados específicos de PIX  
  - obrigatório: não
  - estrutura:
    - `qrCodeText`: string
    - `qrCodeImageUrl`: string
    - `expiresAt`: date

- `gatewayPayload`: object — payload bruto da integração  
  - obrigatório: não
  - observação: armazenado apenas quando necessário para auditoria ou conciliação

- `paidAt`: date — data de confirmação  
  - obrigatório: não

- `refundedAt`: date — data de reembolso  
  - obrigatório: não

- `createdAt`: date — data de criação  
  - obrigatório: sim

- `updatedAt`: date — data da última atualização  
  - obrigatório: sim

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
  - obrigatório: sim

- `donationId`: ObjectId — referência da doação  
  - obrigatório: sim

- `eventType`: enum — tipo do evento  
  - obrigatório: sim
  - valores possíveis:
    - `PICKUP_CONFIRMED`
    - `DRIVER_ASSIGNED`
    - `IN_TRANSIT`
    - `ARRIVED`
    - `DELIVERED`

- `location`: object — localização geográfica  
  - obrigatório: não
  - estrutura:
    - `type`: string — normalmente `Point`
    - `coordinates`: number[] — longitude e latitude

- `description`: string — descrição do evento  
  - obrigatório: não

- `actorUserId`: ObjectId — usuário responsável pelo registro  
  - obrigatório: não

- `photoUrl`: string — foto associada ao evento  
  - obrigatório: não

- `createdAt`: date — data do registro  
  - obrigatório: sim

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
  - obrigatório: sim

- `donationId`: ObjectId — referência da doação  
  - obrigatório: sim

- `photoUrl`: string — URL da foto de comprovação  
  - obrigatório: sim

- `description`: string — descrição da entrega  
  - obrigatório: não

- `confirmedByUserId`: ObjectId — usuário que confirmou  
  - obrigatório: não

- `confirmedAt`: date — data de confirmação  
  - obrigatório: não

- `metadata`: object — informações adicionais da prova  
  - obrigatório: não
  - estrutura:
    - `latitude`: number
    - `longitude`: number
    - `deviceInfo`: string — informação do dispositivo, se aplicável

- `createdAt`: date — data de criação  
  - obrigatório: sim

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
  - obrigatório: sim

- `donationId`: ObjectId — referência da doação  
  - obrigatório: sim

- `donorUserId`: ObjectId — referência do doador  
  - obrigatório: sim

- `institutionId`: ObjectId — referência da instituição  
  - obrigatório: sim

- `receiptNumber`: string — número do comprovante  
  - obrigatório: sim

- `type`: enum — tipo do comprovante  
  - obrigatório: sim
  - valores possíveis:
    - `DONATION_RECEIPT`
    - `TAX_STATEMENT`

- `amount`: number — valor associado  
  - obrigatório: sim

- `issuedAt`: date — data de emissão  
  - obrigatório: sim

- `documentUrl`: string — URL do documento emitido  
  - obrigatório: não

- `metadata`: object — dados auxiliares  
  - obrigatório: não
  - estrutura:
    - `donorCpfMasked`: string — CPF mascarado
    - `institutionCnpj`: string — CNPJ da instituição

- `year`: int — ano de referência  
  - obrigatório: sim

- `createdAt`: date — data de criação  
  - obrigatório: sim

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
  - obrigatório: sim

- `followerUserId`: ObjectId — usuário que está seguindo  
  - obrigatório: sim

- `targetType`: enum — tipo do alvo seguido  
  - obrigatório: sim
  - valores possíveis:
    - `INSTITUTION`
    - `CAMPAIGN`
    - `USER`

- `targetId`: ObjectId — identificador do alvo seguido  
  - obrigatório: sim

- `createdAt`: date — data de criação  
  - obrigatório: sim

### Relacionamentos
- `FOLLOWS N:1 USERS` pelo campo `followerUserId`
- relacionamento polimórfico com:
  - `INSTITUTIONS`
  - `CAMPAIGNS`
  - `USERS`

---

## 3.12. POSTS

### Descrição
Representa publicações do feed social.

### Collection
`posts`

### Campos
- `_id`: ObjectId — identificador único do post  
  - obrigatório: sim

- `authorType`: enum — tipo do autor  
  - obrigatório: sim
  - valores possíveis:
    - `USER`
    - `INSTITUTION`

- `authorId`: ObjectId — identificador do autor  
  - obrigatório: sim
  - observação: o destino depende do `authorType`

- `campaignId`: ObjectId — campanha associada  
  - obrigatório: não

- `institutionId`: ObjectId — instituição associada  
  - obrigatório: não

- `content`: string — conteúdo textual  
  - obrigatório: sim

- `media`: object[] — mídias anexadas  
  - obrigatório: não
  - estrutura de cada item:
    - `type`: enum
      - `IMAGE`
      - `VIDEO`
      - `FILE`
    - `url`: string

- `visibility`: enum — visibilidade do post  
  - obrigatório: sim
  - valores possíveis:
    - `PUBLIC`
    - `FOLLOWERS_ONLY`

- `stats`: object — estatísticas agregadas  
  - obrigatório: não
  - estrutura:
    - `likesCount`: int
    - `commentsCount`: int
    - `sharesCount`: int

- `createdAt`: date — data de criação  
  - obrigatório: sim

- `updatedAt`: date — data da última atualização  
  - obrigatório: sim

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
  - obrigatório: sim

- `postId`: ObjectId — referência do post  
  - obrigatório: sim

- `userId`: ObjectId — referência do autor do comentário  
  - obrigatório: sim

- `parentCommentId`: ObjectId — comentário pai  
  - obrigatório: não
  - observação: usado quando o comentário é resposta de outro comentário

- `content`: string — conteúdo textual  
  - obrigatório: sim

- `createdAt`: date — data de criação  
  - obrigatório: sim

- `updatedAt`: date — data da última atualização  
  - obrigatório: sim

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
  - obrigatório: sim

- `postId`: ObjectId — referência do post  
  - obrigatório: sim

- `userId`: ObjectId — referência do usuário  
  - obrigatório: sim

- `type`: enum — tipo de reação  
  - obrigatório: sim
  - valores possíveis:
    - `LIKE`

- `createdAt`: date — data de criação  
  - obrigatório: sim

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
  - obrigatório: sim

- `type`: enum — tipo da conversa  
  - obrigatório: sim
  - valores possíveis:
    - `DIRECT`
    - `GROUP`

- `participantIds`: ObjectId[] — participantes da conversa  
  - obrigatório: sim

- `institutionId`: ObjectId — referência institucional  
  - obrigatório: não

- `campaignId`: ObjectId — referência de campanha  
  - obrigatório: não

- `lastMessageAt`: date — data da última mensagem  
  - obrigatório: não

- `createdAt`: date — data de criação  
  - obrigatório: sim

- `updatedAt`: date — data da última atualização  
  - obrigatório: sim

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
  - obrigatório: sim

- `conversationId`: ObjectId — referência da conversa  
  - obrigatório: sim

- `senderUserId`: ObjectId — referência do remetente  
  - obrigatório: sim

- `content`: string — conteúdo da mensagem  
  - obrigatório: não
  - observação: pode ser vazio em mensagem apenas com anexo

- `messageType`: enum — tipo da mensagem  
  - obrigatório: sim
  - valores possíveis:
    - `TEXT`
    - `IMAGE`
    - `FILE`
    - `SYSTEM`

- `attachments`: object[] — anexos da mensagem  
  - obrigatório: não
  - estrutura de cada item:
    - `type`: enum
      - `IMAGE`
      - `FILE`
    - `url`: string
    - `fileName`: string

- `readBy`: object[] — usuários que leram a mensagem  
  - obrigatório: não
  - estrutura de cada item:
    - `userId`: ObjectId
    - `readAt`: date

- `createdAt`: date — data de criação  
  - obrigatório: sim

- `updatedAt`: date — data da última atualização  
  - obrigatório: sim

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
  - obrigatório: sim

- `userId`: ObjectId — usuário destinatário  
  - obrigatório: sim

- `type`: enum — tipo da notificação  
  - obrigatório: sim
  - valores possíveis:
    - `DONATION_STATUS_UPDATED`
    - `NEW_FOLLOWER`
    - `NEW_MESSAGE`
    - `CAMPAIGN_UPDATE`

- `title`: string — título  
  - obrigatório: sim

- `body`: string — corpo textual  
  - obrigatório: sim

- `data`: object — dados adicionais  
  - obrigatório: não
  - exemplos:
    - `donationId`: ObjectId
    - `campaignId`: ObjectId
    - `conversationId`: ObjectId

- `readAt`: date — data de leitura  
  - obrigatório: não

- `createdAt`: date — data de criação  
  - obrigatório: sim

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
  - obrigatório: sim

- `reporterUserId`: ObjectId — usuário denunciante  
  - obrigatório: sim

- `targetType`: enum — tipo da entidade denunciada  
  - obrigatório: sim
  - valores possíveis:
    - `USER`
    - `INSTITUTION`
    - `POST`
    - `CAMPAIGN`
    - `MESSAGE`

- `targetId`: ObjectId — entidade denunciada  
  - obrigatório: sim

- `reason`: enum — motivo da denúncia  
  - obrigatório: sim
  - valores possíveis:
    - `FRAUD`
    - `ABUSE`
    - `SPAM`
    - `INAPPROPRIATE_CONTENT`

- `description`: string — detalhamento  
  - obrigatório: não

- `status`: enum — situação da denúncia  
  - obrigatório: sim
  - valores possíveis:
    - `OPEN`
    - `IN_REVIEW`
    - `RESOLVED`
    - `REJECTED`

- `reviewedByUserId`: ObjectId — usuário revisor  
  - obrigatório: não

- `reviewedAt`: date — data da revisão  
  - obrigatório: não

- `createdAt`: date — data de criação  
  - obrigatório: sim

- `updatedAt`: date — data da última atualização  
  - obrigatório: sim

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
  - obrigatório: sim

- `actorUserId`: ObjectId — usuário que realizou a ação  
  - obrigatório: não

- `action`: string — ação executada  
  - obrigatório: sim

- `targetType`: string — tipo da entidade afetada  
  - obrigatório: sim

- `targetId`: ObjectId — entidade afetada  
  - obrigatório: não

- `metadata`: object — informações adicionais  
  - obrigatório: não
  - exemplos:
    - `oldStatus`: string
    - `newStatus`: string
    - `notes`: string

- `ip`: string — endereço IP  
  - obrigatório: não

- `userAgent`: string — identificador do cliente  
  - obrigatório: não

- `createdAt`: date — data do evento  
  - obrigatório: sim

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
  - obrigatório: sim

- `type`: enum — tipo de categoria  
  - obrigatório: sim
  - valores possíveis:
    - `DONATION_ITEM`
    - `INSTITUTION_CAUSE`

- `name`: string — nome da categoria  
  - obrigatório: sim

- `slug`: string — identificador textual amigável  
  - obrigatório: sim

- `isActive`: boolean — indica se está ativa  
  - obrigatório: sim

- `createdAt`: date — data de criação  
  - obrigatório: sim

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
```

---

# 5. Observações finais

A modelagem proposta busca equilibrar clareza de domínio, rastreabilidade e flexibilidade para evolução futura da plataforma. Como o banco adotado é o MongoDB, os relacionamentos serão tratados conceitualmente pela aplicação e representados por referências entre collections.

Esse documento pode ser utilizado como base para:
- criação dos schemas do MongoDB;
- implementação das entidades e DTOs do back-end;
- documentação acadêmica do projeto;
- alinhamento funcional entre front-end e back-end.
