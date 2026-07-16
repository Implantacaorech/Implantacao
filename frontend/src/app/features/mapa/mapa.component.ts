import { Component } from '@angular/core';
import { NoMapa, NoMapaComponent } from './no-mapa.component';

const MAPA: NoMapa = {
  nome: 'Implantação SIGER®',
  filhos: [
    {
      nome: '👥 Papéis (Agentes)',
      filhos: [
        { nome: 'Coordenação da Implantação' },
        { nome: 'Setor Adm' },
        { nome: 'Consultor de Implantação (GCI)' },
        { nome: 'Gerente do Projeto' },
        { nome: 'Equipe de Conversão' },
        { nome: 'Gestão da Mudança (OCM)' },
      ],
    },
    {
      nome: '🔎 Pré-implantação',
      filhos: [
        { nome: 'Levantamento de processos (apoio comercial)' },
        { nome: 'Apoio comercial / Demonstração' },
      ],
    },
    {
      nome: '🛠️ Implantação',
      filhos: [
        { nome: 'Abertura da implantação' },
        { nome: 'Manutenção da RNS(I)' },
        { nome: 'Registros no SICLA (12/13)' },
        { nome: 'Levantamento micro' },
        { nome: 'Aderência ao SIGER' },
        { nome: 'Encaminhar conversões (ORC/COB)' },
        { nome: 'Encaminhar desenvolvimentos' },
        { nome: 'Projeto de Implantação' },
        { nome: 'Cronograma (até 5 dias úteis)' },
        { nome: 'Parametrizações (1.1.P / 1.2.A / 1.2.M)' },
        { nome: 'Treinamento de rotinas' },
        { nome: 'Simulações (micro e macro)' },
        { nome: 'Virada oficial' },
        { nome: 'Acompanhamento de produção' },
        { nome: 'Encerramento (Termo + e-mail final)' },
      ],
    },
    {
      nome: '✅ Qualidade e Robustez',
      filhos: [
        { nome: 'P0 — Gestão da Mudança (OCM/ADKAR)' },
        { nome: 'P0 — Testes SIT/UAT (gate da virada)' },
        { nome: 'P1 — Validação de conversão' },
        { nome: 'P1 — Hypercare' },
        { nome: 'P1 — Fit/Gap' },
        { nome: 'P2 — KPIs' },
        { nome: 'P2 — RAID' },
        { nome: 'P2 — Dossiê do cliente' },
      ],
    },
    {
      nome: '📑 Convenções',
      filhos: [
        { nome: 'SICLA: 12=apoio comercial · 13=implantação · 84=agenda interna' },
        { nome: 'RNS: RNS(I) · ORC · COB' },
        { nome: 'Projeto + Cronograma: até 5 dias úteis após o levantamento' },
        { nome: 'Documentos obrigatórios: Projeto · Cronograma · Termo' },
      ],
    },
  ],
};

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [NoMapaComponent],
  templateUrl: './mapa.component.html',
  styleUrl: './mapa.component.css',
})
export class MapaComponent {
  readonly mapa = MAPA;

  expandirTudo(abrir: boolean): void {
    document.querySelectorAll<HTMLDetailsElement>('.mm details').forEach((d) => (d.open = abrir));
  }
}
