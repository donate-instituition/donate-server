# Diagrama Entidade-Relacionamento

Este documento resume a modelagem entidade-relacionamento do projeto **donate-server**, baseada nos schemas Mongoose em `src/domains/*/schemas`.

O arquivo principal do diagrama está em:

```text
docs/diagrama-entidade-relacionamento.mmd
```

## Como visualizar

Cole o conteúdo do arquivo `.mmd` no Mermaid Live Editor ou em qualquer editor com suporte a Mermaid.

Também é possível renderizar localmente com Mermaid CLI:

```bash
npx @mermaid-js/mermaid-cli -i docs/diagrama-entidade-relacionamento.mmd -o docs/diagrama-entidade-relacionamento.pdf
```

## Observações da modelagem

- O banco é MongoDB, então os relacionamentos são representados por `ObjectId`.
- Algumas relações são polimórficas e dependem de campos como `targetType` ou `authorType`.
- Os campos `targetId` em `follows`, `reports` e `audit_logs` não possuem `ref` fixo no schema.
- `posts.authorId` depende de `authorType`, podendo representar usuário ou instituição.
- `conversations.participantIds` e `messages.readBy.userId` representam listas de usuários.
- `campaigns` possui coleções de comentários e reações próprias (`campaign_comments`, `campaign_reactions`), distintas de `post_comments`/`post_reactions`, que continuam vinculadas apenas a `posts`.
- `delivery_proofs.donationId` e `delivery_proofs.campaignId` são ambos opcionais e mutuamente alternativos: a prova pode estar associada a uma doação ou diretamente a uma campanha.
- `users.roles` é uma lista (não um único papel): cada item guarda `name`, `grantedAt` e `grantedBy` (com `grantedBy.userId` opcionalmente apontando para outro usuário que concedeu o papel — um auto-relacionamento em `users`).
- `terms.version` e `users.acceptedTermsVersion` se relacionam apenas conceitualmente (por valor), sem `ref` fixo no schema.
- `app_settings`, `support_faqs` e `stripe_webhook_events` são entidades operacionais/administrativas sem relacionamento direto (`ref`) com as demais collections.

## Principais relacionamentos

| Origem | Destino | Campo |
| --- | --- | --- |
| `users` | `institution_staff_memberships` | `userId`, `invitedByUserId` |
| `institutions` | `institution_staff_memberships` | `institutionId` |
| `categories` | `institutions` | `categoryIds` |
| `institutions` | `campaigns` | `institutionId` |
| `users` | `campaigns` | `createdByUserId` |
| `users` | `donations` | `donorUserId` |
| `institutions` | `donations` | `institutionId` |
| `campaigns` | `donations` | `campaignId` |
| `donations` | `payments` | `donationId` |
| `donations` | `delivery_proofs` | `donationId` |
| `campaigns` | `delivery_proofs` | `campaignId` |
| `donations` | `tax_receipts` | `donationId` |
| `donations` | `donation_status_history` | `donationId` |
| `donations` | `tracking_events` | `donationId` |
| `posts` | `post_comments` | `postId` |
| `posts` | `post_reactions` | `postId` |
| `campaigns` | `campaign_comments` | `campaignId` |
| `users` | `campaign_comments` | `userId` |
| `campaigns` | `campaign_reactions` | `campaignId` |
| `users` | `campaign_reactions` | `userId` |
| `conversations` | `messages` | `conversationId` |
| `users` | `conversations` | `participantIds` |
| `institutions` | `conversations` | `institutionId` |
| `campaigns` | `conversations` | `campaignId` |
| `users` | `notifications` | `userId` |
| `users` | `follows` | `followerUserId` |
| `institutions` | `follows` | `targetId` quando `targetType` for instituição |
| `campaigns` | `follows` | `targetId` quando `targetType` for campanha |
| `users` | `follows` | `targetId` quando `targetType` for usuário |
| `users` | `reports` | `reporterUserId`, `reviewedByUserId`, `targetId` quando `targetType` for usuário |
| `institutions` | `reports` | `targetId` quando `targetType` for instituição |
| `campaigns` | `reports` | `targetId` quando `targetType` for campanha |
| `posts` | `reports` | `targetId` quando `targetType` for post |
| `messages` | `reports` | `targetId` quando `targetType` for mensagem |
| `users` | `audit_logs` | `actorUserId` |
| `users` | `error_logs` | `userId` |
| `users` | `users` | `roles[].grantedBy.userId` (auto-relacionamento) |
