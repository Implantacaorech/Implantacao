/**
 * Guarda automática do **Guia Mestre de Arquitetura de Desenvolvimento**
 * (`vault/23 - Padrões/Guia Mestre de Arquitetura de Desenvolvimento.md`, ADR-0002)
 * traduzido para o Angular.
 *
 * O guia é escrito sobre um backend (Controller → Service → Repository). No frontend o
 * princípio equivalente é o mesmo — **baixo acoplamento e responsabilidade única**:
 *
 * | Guia (backend)                     | Aqui (Angular)                                  |
 * |------------------------------------|-------------------------------------------------|
 * | Controller não acessa banco        | Componente não fala HTTP direto                 |
 * | Service concentra a regra          | `core/services/` concentra integração e regra   |
 * | Repository só persiste             | O service é quem conhece rota, verbo e envelope |
 * | Injeção de dependência, sem `new`  | `inject()`/DI do Angular                        |
 *
 * Mesma mecânica de `padroes-layout.spec.ts`: não renderiza nada, varre os próprios
 * arquivos via `import.meta.glob` (Vite) e falha quando o desvio reaparece.
 */

type Arquivos = Record<string, string>;

// O padrão do glob precisa ser LITERAL na chamada (o Vite resolve em tempo de build, não
// em tempo de execução) — por isso as duas chamadas repetem as opções em vez de passarem
// por um helper.
const COMPONENTES = (import.meta as unknown as {
  glob(p: string, o: object): Arquivos;
}).glob('./**/*.component.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const SERVICES = (import.meta as unknown as {
  glob(p: string, o: object): Arquivos;
}).glob('./core/services/**/*.service.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * Componentes que ainda falam HTTP direto — **dívida conhecida, lista só pode ENCOLHER**.
 *
 * **Zerada em 2026-08-02.** Os três que existiam viraram services em `core/services/`:
 * `permissoes` → `PermissoesAdminService` (piloto), `matriz-detalhada` →
 * `MatrizDetalhadaService`, `matriz-funcoes` → `MatrizFuncoesService`.
 *
 * A constante fica aqui, vazia, de propósito: é o registro de que a regra vale para TODOS
 * os componentes, sem exceção. Voltar a preenchê-la é decisão de arquitetura, não atalho
 * de implementação.
 */
const COMPONENTES_COM_HTTP_PENDENTES: string[] = [];

function linhaDe(txt: string, idx: number): number {
  return txt.slice(0, idx).split('\n').length;
}

describe('conformidade com o Guia Mestre (adaptado ao Angular)', () => {
  it('encontra os arquivos para inspecionar', () => {
    expect(Object.keys(COMPONENTES).length).toBeGreaterThan(40);
    expect(Object.keys(SERVICES).length).toBeGreaterThan(20);
  });

  it('componente não injeta HttpClient — quem fala com a API é um service', () => {
    const novos = Object.entries(COMPONENTES)
      .filter(([, txt]) => /\bHttpClient\b/.test(txt))
      .map(([arq]) => arq)
      .filter((arq) => !COMPONENTES_COM_HTTP_PENDENTES.includes(arq));

    expect(
      novos,
      'Crie um service em core/services/ e injete ele no componente ' +
        `(modelo: PermissoesAdminService):\n${novos.join('\n')}`,
    ).toEqual([]);
  });

  it('a lista de dívida não cresce nem envelhece', () => {
    // Se um pendente foi adequado, a entrada TEM de sair da lista — senão a catraca
    // afrouxa sozinha e o próximo desvio entra sem ninguém ver.
    const aindaUsamHttp = COMPONENTES_COM_HTTP_PENDENTES.filter((arq) =>
      /\bHttpClient\b/.test(COMPONENTES[arq] ?? ''),
    );
    expect(
      aindaUsamHttp,
      'Componente já adequado continua na lista de pendentes — remova a entrada de ' +
        'COMPONENTES_COM_HTTP_PENDENTES',
    ).toEqual(COMPONENTES_COM_HTTP_PENDENTES);
  });

  it('componente não monta URL da API na mão', () => {
    // `environment.apiUrl` no componente significa que a tela conhece o desenho da API —
    // exatamente o acoplamento que o service existe para absorver.
    const falhas: string[] = [];
    for (const [arq, txt] of Object.entries(COMPONENTES)) {
      if (COMPONENTES_COM_HTTP_PENDENTES.includes(arq)) continue;
      for (const m of txt.matchAll(/environment\.apiUrl/g)) {
        falhas.push(`${arq}:${linhaDe(txt, m.index)}`);
      }
    }
    expect(
      falhas,
      `Mova a montagem da URL para o service:\n${falhas.join('\n')}`,
    ).toEqual([]);
  });

  it('service não importa componente (a seta aponta só para uma direção)', () => {
    const falhas: string[] = [];
    for (const [arq, txt] of Object.entries(SERVICES)) {
      if (/from '.*\.component'/.test(txt)) falhas.push(arq);
    }
    expect(
      falhas,
      `Service → Component inverte a camada:\n${falhas.join('\n')}`,
    ).toEqual([]);
  });

  it('service usa inject()/DI, nunca `new` de outro service', () => {
    const falhas: string[] = [];
    for (const [arq, txt] of Object.entries(SERVICES)) {
      for (const m of txt.matchAll(/new\s+(\w+Service)\s*\(/g)) {
        falhas.push(`${arq}:${linhaDe(txt, m.index)} → new ${m[1]}()`);
      }
    }
    expect(
      falhas,
      `Use inject() em vez de instanciar:\n${falhas.join('\n')}`,
    ).toEqual([]);
  });
});
