import { WritableSignal, effect, inject } from '@angular/core';
import { PreferenciasService } from '../services/preferencias.service';

/** Um filtro persistido: como lê-lo da tela e como devolvê-lo à tela.
 *
 * Métodos (e não propriedades de função) de propósito: assim `CampoFiltro<string>` continua
 * atribuível a `CampoFiltro<unknown>` e um mapa de campos aceita tipos diferentes na mesma
 * declaração. */
export interface CampoFiltro<T> {
  ler(): T;
  aplicar(valor: T): void;
}

/** Campo ligado a um signal — o caso comum, e o único com gravação automática. */
export function deSignal<T>(sig: WritableSignal<T>): CampoFiltro<T> {
  return { ler: () => sig(), aplicar: (v) => sig.set(v) };
}

/** Campo ligado a uma propriedade simples da tela (as que o `[(ngModel)]` escreve direto).
 * Propriedade comum não é observável: a tela precisa chamar `salvar()` ao aplicar o filtro. */
export function deCampo<T>(
  ler: () => T,
  aplicar: (valor: T) => void,
): CampoFiltro<T> {
  return { ler, aplicar };
}

/** Vários campos de propriedade comum do MESMO objeto, de uma vez — o caso das telas em que
 * os filtros são campos soltos com `[(ngModel)]`:
 *
 * ```ts
 * filtrosSalvos('protocolos', deCamposDe(this, 'fModulo', 'fStatus', 'fQ'));
 * ```
 */
export function deCamposDe<T extends object, K extends keyof T & string>(
  alvo: T,
  ...nomes: K[]
): Record<K, CampoFiltro<T[K]>> {
  const mapa = {} as Record<K, CampoFiltro<T[K]>>;
  for (const nome of nomes) {
    mapa[nome] = {
      ler: () => alvo[nome],
      aplicar: (valor) => {
        alvo[nome] = valor;
      },
    };
  }
  return mapa;
}

/** Campo cuja tela guarda a seleção num `Set` (no banco vai como lista). */
export function deSet(
  ler: () => Set<string>,
  aplicar: (valor: Set<string>) => void,
): CampoFiltro<string[]> {
  return { ler: () => [...ler()], aplicar: (v) => aplicar(new Set(v)) };
}

export interface OpcoesFiltrosSalvos {
  /** Chamado quando a restauração aconteceu TARDE — as preferências ainda não estavam em
   * memória — e mudou algum filtro. Recarregue os dados da tela aqui.
   *
   * No caminho normal não roda: o `authGuard` pré-carrega as preferências, a restauração é
   * síncrona no construtor e a primeira carga da tela já usa o filtro salvo. Isto cobre o
   * caso da tela montada fora daquele fluxo (teste, deep link enquanto o mapa vem). */
  aoRestaurar?: () => void;
}

export interface FiltrosSalvos {
  /** Grava o estado atual. Só é necessário em tela cujos filtros são propriedade comum
   * (`deCampo`) — chame ao aplicar o filtro. Com signals a gravação é automática. */
  salvar(): void;
  /** Esquece a seleção salva desta tela. Chame DEPOIS de zerar os filtros, no "Limpar":
   * apagar a preferência devolve a tela aos padrões dela, em vez de congelar "tudo em
   * branco" como se fosse a escolha do usuário. */
  descartar(): Promise<void>;
}

function ehPrimitivo(v: unknown): boolean {
  return (
    v === null ||
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean'
  );
}

/** O que veio do banco tem o formato que esta tela espera?
 *
 * Preferência é dado antigo por natureza: fica guardada meses e a tela muda no meio. Sem esta
 * checagem, um filtro que era texto e virou lista entraria como texto e quebraria a tela na
 * primeira renderização. O gabarito é o valor PADRÃO do campo (o que a tela tinha antes de
 * restaurar) — não é preciso declarar o tipo duas vezes. */
function compativel(padrao: unknown, salvo: unknown): boolean {
  if (Array.isArray(padrao)) {
    return Array.isArray(salvo) && salvo.every(ehPrimitivo);
  }
  // Padrão nulo não diz o tipo (ex.: `mesSel: number | null`) — aceita qualquer primitivo.
  if (padrao === null || padrao === undefined) return ehPrimitivo(salvo);
  return typeof padrao === typeof salvo && ehPrimitivo(salvo);
}

/** Liga os filtros de uma tela à preferência do usuário logado: restaura ao abrir e grava
 * quando mudam. Chame de dentro do construtor (precisa de contexto de injeção).
 *
 * ```ts
 * private readonly salvos = filtrosSalvos('capacidade', {
 *   modulos: deSignal(this.modulos),
 *   setor: deSignal(this.setor),
 * }, { aoRestaurar: () => void this.carregar() });
 * ```
 *
 * Declare os filtros ANTES de qualquer carga de dados no construtor: as preferências já
 * estão em memória (o `authGuard` as carrega), a restauração é síncrona e a carga seguinte
 * já sai filtrada. */
export function filtrosSalvos(
  chave: string,
  campos: Record<string, CampoFiltro<unknown>>,
  opcoes: OpcoesFiltrosSalvos = {},
): FiltrosSalvos {
  const prefs = inject(PreferenciasService);
  const entradas = Object.entries(campos);
  const padroes = new Map(entradas.map(([nome, c]) => [nome, c.ler()]));
  const padraoJson = JSON.stringify(Object.fromEntries(padroes));

  const estado = (): Record<string, unknown> => {
    const atual: Record<string, unknown> = {};
    for (const [nome, c] of entradas) atual[nome] = c.ler();
    return atual;
  };

  let pronto = false;

  /** Aplica o que está salvo. Devolve se mudou algo — é o que decide recarregar a tela no
   * caminho tardio. */
  const restaurar = (): boolean => {
    const salvo = prefs.ler<Record<string, unknown>>(chave);
    let mudou = false;
    if (salvo && typeof salvo === 'object' && !Array.isArray(salvo)) {
      for (const [nome, c] of entradas) {
        if (!(nome in salvo)) continue;
        const padrao = padroes.get(nome);
        // A tela já saiu do padrão neste campo (o usuário mexeu, ou a rota o preencheu —
        // como o `?q=` da Carteira) enquanto a preferência vinha. O que está na tela ganha.
        if (JSON.stringify(c.ler()) !== JSON.stringify(padrao)) continue;
        const valor = salvo[nome];
        if (!compativel(padrao, valor)) continue;
        if (JSON.stringify(valor) === JSON.stringify(padrao)) continue;
        c.aplicar(valor);
        mudou = true;
      }
    }
    pronto = true;
    return mudou;
  };

  if (prefs.carregadas) {
    restaurar();
  } else {
    void prefs.garantirCarregado().then(() => {
      if (restaurar()) opcoes.aoRestaurar?.();
    });
  }

  effect(() => {
    const atual = estado(); // lê tudo primeiro: é o que registra os signals como dependência
    if (!pronto) return;
    // Tela no padrão e nada salvo ainda: não grava. Evita criar uma preferência "nenhum
    // filtro" só porque a pessoa passou pela tela. Se JÁ existe algo salvo, grava mesmo
    // igual ao padrão — é assim que "voltei tudo ao normal" sobrescreve o antigo.
    if (JSON.stringify(atual) === padraoJson && prefs.ler(chave) === null) return;
    prefs.salvar(chave, atual);
  });

  return {
    salvar: () => {
      if (!pronto) return;
      const atual = estado();
      if (JSON.stringify(atual) === padraoJson && prefs.ler(chave) === null) return;
      prefs.salvar(chave, atual);
    },
    descartar: () => prefs.descartar(chave, padraoJson),
  };
}
