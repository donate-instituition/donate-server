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
| `donations` | `tax_receipts` | `donationId` |
| `donations` | `donation_status_history` | `donationId` |
| `donations` | `tracking_events` | `donationId` |
| `posts` | `post_comments` | `postId` |
| `posts` | `post_reactions` | `postId` |
| `conversations` | `messages` | `conversationId` |
| `users` | `notifications` | `userId` |
| `users` | `follows` | `followerUserId` |
| `institutions` | `follows` | `targetId` quando `targetType` for instituição |
| `campaigns` | `follows` | `targetId` quando `targetType` for campanha |
| `users` | `reports` | `reporterUserId`, `reviewedByUserId` |
| `users` | `audit_logs` | `actorUserId` |
