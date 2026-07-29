/**
 * Travas de padronização visual e de binding.
 *
 * Estes testes não renderizam nada: varrem os próprios templates e falham
 * quando reaparece um padrão que já causou defeito em produção. A intenção é
 * que o desalinhamento dos botões e o filtro quebrado não voltem por descuido
 * ao criar uma tela nova.
 *
 * Os arquivos entram via import.meta.glob (Vite), sem depender do módulo `fs`.
 */

/** Mapa caminho → conteúdo dos templates e dos componentes. */
type Arquivos = Record<string, string>;

const TEMPLATES = (import.meta as unknown as {
  glob(p: string, o: object): Arquivos;
}).glob('./**/*.component.html', { query: '?raw', import: 'default', eager: true });

const FONTES = (import.meta as unknown as {
  glob(p: string, o: object): Arquivos;
}).glob('./**/*.component.ts', { query: '?raw', import: 'default', eager: true });

const entradas = Object.entries(TEMPLATES);

/** Índice do `</tag>` que fecha a tag aberta em `ini`, respeitando aninhamento. */
function fechamento(txt: string, ini: number, tag: string): number {
  const ab = `<${tag}`;
  const fe = `</${tag}>`;
  let prof = 0;
  for (let i = ini; i < txt.length; i++) {
    if (txt.startsWith(ab, i)) prof++;
    else if (txt.startsWith(fe, i) && --prof === 0) return i;
  }
  return -1;
}

function linhaDe(txt: string, idx: number): number {
  return txt.slice(0, idx).split('\n').length;
}

describe('padrões de layout nos templates', () => {
  it('encontra os templates para inspecionar', () => {
    expect(entradas.length).toBeGreaterThan(40);
  });

  it('não mistura .campo e .btn num flex solto (usar .filtros-linha / .barra-filtros / .acoes)', () => {
    // Numa linha flex com align-items:flex-end o navegador alinha pela borda
    // externa. Como .campo traz margin-bottom:16px e .btn traz 8px, o botão
    // descia 8px em relação ao campo ao lado. As primitivas zeram as margens.
    const falhas: string[] = [];

    for (const [arq, txt] of entradas) {
      for (const m of txt.matchAll(/<(form|div)[^>]*\bstyle="[^"]*display:\s*flex[^"]*"[^>]*>/g)) {
        const fim = fechamento(txt, m.index, m[1]);
        if (fim === -1) continue;
        const interior = txt.slice(m.index + m[0].length, fim);
        if (interior.includes('class="campo') && interior.includes('class="btn')) {
          falhas.push(`${arq}:${linhaDe(txt, m.index)}`);
        }
      }
    }

    expect(
      falhas,
      `Use class="filtros-linha" (dentro de painel) ou "barra-filtros" (solta):\n${falhas.join('\n')}`,
    ).toEqual([]);
  });

  it('não usa [(ngModel)] sobre um signal', () => {
    // [(ngModel)]="sig" passa a FUNÇÃO como valor e, ao editar, substitui o
    // signal por um primitivo — a leitura seguinte (sig()) estoura e o filtro
    // para de funcionar. O correto é [ngModel]="sig()" + (ngModelChange).
    const falhas: string[] = [];

    for (const [arq, txt] of entradas) {
      const codigo = FONTES[arq.replace(/\.html$/, '.ts')];
      if (!codigo) continue;
      const signals = new Set(
        [...codigo.matchAll(/(?:readonly\s+)?(\w+)\s*=\s*(?:signal|computed)\s*[<(]/g)].map((m) => m[1]),
      );
      for (const m of txt.matchAll(/\[\(ngModel\)\]="(\w+)\(?\)?"/g)) {
        if (signals.has(m[1])) falhas.push(`${arq}:${linhaDe(txt, m.index)} → ${m[1]}`);
      }
    }

    expect(
      falhas,
      `Troque por [ngModel]="x()" (ngModelChange)="x.set($event)":\n${falhas.join('\n')}`,
    ).toEqual([]);
  });

  it('usa .pagina-titulo nos títulos de tela, sem style inline', () => {
    const falhas: string[] = [];
    for (const [arq, txt] of entradas) {
      for (const m of txt.matchAll(/<h1[^>]*>/g)) {
        if (m[0].includes('style=') || !m[0].includes('pagina-titulo')) {
          falhas.push(`${arq}:${linhaDe(txt, m.index)}`);
        }
      }
    }
    expect(falhas, `Use <h1 class="pagina-titulo">:\n${falhas.join('\n')}`).toEqual([]);
  });

  it('não define tamanho de ícone por style inline (usar a escala .svgi-*)', () => {
    const falhas: string[] = [];
    for (const [arq, txt] of entradas) {
      for (const m of txt.matchAll(/<svg class="svgi[^"]*"[^>]*style="([^"]*)"/g)) {
        if (/width|height/.test(m[1])) falhas.push(`${arq}:${linhaDe(txt, m.index)}`);
      }
    }
    expect(falhas, `Use .svgi-xs/-sm/-md/-lg/-xl:\n${falhas.join('\n')}`).toEqual([]);
  });

  it('toda tabela tem classe, e as genéricas ficam em .tabela-wrap', () => {
    // Tabelas com classe própria (.dsh-tab, .perm-tab, .grade-tab…) já trazem o
    // contêiner de rolagem no CSS do respectivo componente. A exigência de
    // .tabela-wrap vale para as genéricas, que não têm regra própria.
    const GENERICAS = ['tabela', 'form-tab'];
    const falhas: string[] = [];

    for (const [arq, txt] of entradas) {
      for (const m of txt.matchAll(/<table([^>]*)>/g)) {
        const onde = `${arq}:${linhaDe(txt, m.index)}`;
        const cls = /class="([^"]*)"/.exec(m[1]);
        if (!cls) {
          falhas.push(`${onde} (sem classe)`);
          continue;
        }
        if (!cls[1].split(/\s+/).some((n) => GENERICAS.includes(n))) continue;
        const antes = txt.slice(0, m.index).trimEnd();
        if (!/class="tabela-wrap[^"]*"\s*>$/.test(antes)) {
          falhas.push(`${onde} (.${cls[1]} sem .tabela-wrap)`);
        }
      }
    }
    expect(falhas, `Envolva a tabela em <div class="tabela-wrap">:\n${falhas.join('\n')}`).toEqual([]);
  });
});
