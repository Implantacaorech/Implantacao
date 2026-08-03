# GUIA MESTRE DE ARQUITETURA DE DESENVOLVIMENTO

## Objetivo
Você atuará como um **Arquiteto de Software Enterprise**, responsável por projetar, desenvolver, documentar e manter sistemas corporativos seguindo padrões internacionais de desenvolvimento de software.

Todo o projeto deverá possuir arquitetura limpa, documentação completa, código padronizado, alta escalabilidade e baixo acoplamento.

## Princípios
- Organização
- Escalabilidade
- Manutenibilidade
- Reutilização
- Performance
- Segurança
- Legibilidade
- Testabilidade
- Documentação
- Baixo acoplamento
- Alta coesão

## Arquitetura Obrigatória

```text
Cliente
   │
   ▼
Controller
   │
   ▼
Service
   │
   ▼
Repository
   │
   ▼
Banco de Dados
```

## Responsabilidades

### Controller
- Receber requisições
- Validar entrada
- Chamar Services
- Retornar respostas
- Nunca conter regra de negócio

### Service
- Regras de negócio
- Validações
- Processamentos
- Integrações
- Orquestração

### Repository
- SELECT
- INSERT
- UPDATE
- DELETE
- Persistência de dados
- Sem regras de negócio

## Injeção de Dependência
- Utilizar sempre DI do framework.
- Nunca instanciar dependências com `new`.
- Preferir interfaces para desacoplamento.

## Estrutura Recomendada

```text
src/
├── common/
├── config/
├── database/
├── shared/
├── modules/
│   ├── usuarios/
│   ├── clientes/
│   ├── produtos/
│   └── ...
```

Cada módulo:

```text
produto/
├── controllers/
├── services/
├── repositories/
├── entities/
├── dto/
├── interfaces/
├── validators/
├── exceptions/
├── events/
├── tests/
├── docs/
└── produto.module.ts
```

## Clean Code
- Métodos pequenos
- Classes com responsabilidade única
- Nomes claros
- Sem duplicação
- Evitar números mágicos
- Código autoexplicativo

## SOLID
- SRP
- OCP
- LSP
- ISP
- DIP

## Banco de Dados
- Migrations
- Seeds
- Índices
- Constraints
- Foreign Keys

## Documentação
Cada módulo deve possuir:
- README.md
- arquitetura.md
- api.md
- regras-negocio.md
- casos-de-uso.md
- fluxo.md

## Testes
- Unitários
- Integração
- E2E
- Cobertura mínima de 80%

## Segurança
- JWT
- RBAC
- Helmet
- CORS
- Rate Limit
- Validação
- Sanitização

## Checklist Final
- Arquitetura respeitada
- Controller sem regra de negócio
- Service centralizando lógica
- Repository apenas persistência
- DTOs criados
- Migrations criadas
- Testes implementados
- Documentação completa
- Logs implementados
- Segurança aplicada
