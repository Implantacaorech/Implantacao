import { Component, computed, input } from '@angular/core';
import { LinhaRns } from '../../core/models/rns.model';

/** Um par rótulo→valor da ficha; `vazio` esmaece o "—" para o olho ir direto ao que está
 * preenchido. */
interface CampoDetalhe {
  rotulo: string;
  valor: string;
  vazio: boolean;
}

/** Um grupo (cartão) da ficha — Identificação, Datas, Responsáveis… */
interface GrupoDetalhe {
  titulo: string;
  campos: CampoDetalhe[];
}

/** Valor de cobrança em reais — Intl direto porque a tela inteira é pt-BR fixo. */
const MOEDA_BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** A FICHA de uma RNS (o "resumo completo"): visão geral, grupos rótulo→valor e os textos
 * longos (detalhamento, motivo, parecer). Nasceu do detalhe expandido da tela Execução →
 * RNS e virou componente para o calendário da Agenda abrir a MESMA ficha num modal ao
 * clicar num compromisso — um só desenho de ficha para o sistema inteiro. */
@Component({
  selector: 'app-rns-detalhe',
  standalone: true,
  templateUrl: './rns-detalhe.component.html',
  styleUrl: './rns-detalhe.component.css',
})
export class RnsDetalheComponent {
  readonly linha = input.required<LinhaRns>();

  readonly grupos = computed<GrupoDetalhe[]>(() => {
    const l = this.linha();
    return [
      {
        titulo: 'Identificação',
        campos: [
          this.campoDuplo('Pedido / Item', l.pedido, l.item),
          this.campo('Código', l.codigo),
          this.campo('Cliente (cód.)', l.cliente),
          this.campo('Projeto', l.projeto),
          this.campo('Tipo / Subtipo', l.subtipo ? `${this.ou(l.tipoDes)} · ${l.subtipo}` : l.tipoDes),
          this.campo('Prioridade', l.prioridade),
          this.campoDuplo('Prioridade A / Ana', l.prioridadeA, l.prioridadeAna),
          this.campo('Backlog', l.backlogDes),
          this.campo('Fase', l.faseDes),
          this.campo('Requisito', l.requisitoDes),
          this.campo('Status', l.statusDes),
          this.campo('Status público', l.statusPubDes),
          this.campoDuplo('Disponível / Tem req.', l.disponivel, l.temReq),
        ],
      },
      {
        titulo: 'Datas',
        campos: [
          this.campoData('Criação', l.dataCri),
          this.campoData('Desejada', l.dataDesejada),
          this.campoData('Prevista', l.dataPrevista),
          this.campoData('Prev. fim produção', l.dataPrevFimProd),
          this.campoData('Status 8', l.dataStatus8),
          this.campoData('Status 10', l.dataStatus10),
          this.campo('Dias de triagem', l.diasTriagem),
        ],
      },
      {
        titulo: 'Cliente · Produto',
        campos: [
          this.campo('Fantasia', l.fantasia),
          this.campo('Sigla', l.sigla),
          this.campo('Contato', l.contato),
          this.campo('Versão atual', l.versaoAtu),
          this.campo('Versão liberada', l.versaoLib),
          this.campo('Mín. p/ geração', l.minVerGeracao),
        ],
      },
      {
        titulo: 'Responsáveis',
        campos: [
          this.campo('Consultor', l.resNome),
          this.campo('Analista', l.anaNome),
          this.campo('Val. coordenador', l.valCoordenadorDes),
          this.campo('Val. técnico', l.valTecnicoDes),
          this.campo('Val. grupo', l.valGrupoDes),
          this.campo('Função', l.funcaoDes),
          this.campo('Representante', l.represenDes),
          this.campo('Product owner', l.productOwnerDes),
        ],
      },
      {
        titulo: 'Organização · Produção',
        campos: [
          this.campo('Célula', l.celula),
          this.campo('Menu', l.menu),
          this.campo('Time', l.timeDes),
          this.campo('Turnos previstos', l.turnosPrev),
          this.campo('Pontos', l.pontos),
        ],
      },
      {
        titulo: 'Protocolo · RNS · Valor',
        campos: [
          this.campo('Protocolo', l.protocolo),
          this.campo('RNS filhas', l.rnsFilhas),
          this.campo('Valor cobrança', l.valorCob === null ? null : MOEDA_BRL.format(l.valorCob)),
        ],
      },
    ];
  });

  private campo(rotulo: string, v: string | number | null): CampoDetalhe {
    const vazio = v === null || v === '';
    return { rotulo, valor: vazio ? '—' : String(v), vazio };
  }

  /** Par "A / B": mostra os dois lados (com — no que faltar); vazio só se ambos faltam. */
  private campoDuplo(
    rotulo: string,
    a: string | number | null,
    b: string | number | null,
  ): CampoDetalhe {
    const ambosVazios = (a === null || a === '') && (b === null || b === '');
    return ambosVazios
      ? { rotulo, valor: '—', vazio: true }
      : { rotulo, valor: `${this.ou(a)} / ${this.ou(b)}`, vazio: false };
  }

  private campoData(rotulo: string, iso: string): CampoDetalhe {
    return { rotulo, valor: this.dataBr(iso), vazio: !iso };
  }

  private dataBr(iso: string): string {
    return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—';
  }

  private ou(v: string | number | null): string {
    return v === null || v === '' ? '—' : String(v);
  }
}
