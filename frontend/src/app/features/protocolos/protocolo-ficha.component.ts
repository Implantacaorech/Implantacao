import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProtocoloService } from '../../core/services/protocolo.service';
import {
  CampoTextoProtocolo,
  PROTO_CAMPOS_EDICAO,
  PROTO_MODULOS,
  Protocolo,
  StatusProtocolo,
} from '../../core/models/protocolo.model';

const ETAPAS = ['Recebido', 'Transcrição', 'Análise IA', 'Em revisão', 'Aprovado'];

const IDX_POR_STATUS: Record<StatusProtocolo, number> = {
  Pendente: 0,
  Transcrevendo: 1,
  Analisando: 2,
  'Em revisão': 3,
  'Reprovado / Ajustar': 3,
  Aprovado: 4,
  Erro: -1,
};

const EM_ANDAMENTO: StatusProtocolo[] = ['Pendente', 'Transcrevendo', 'Analisando'];

export interface EtapaTimeline {
  nome: string;
  numero: number;
  classe: 'erro' | 'feita' | 'ativa' | '';
  linhaFeita: boolean;
}

function fmt(s: number): string {
  const t = Math.max(0, s | 0);
  const m = (t / 60) | 0;
  const seg = String(t % 60).padStart(2, '0');
  return `${m}:${seg}`;
}

@Component({
  selector: 'app-protocolo-ficha',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './protocolo-ficha.component.html',
  styleUrl: './protocolo-ficha.component.css',
})
export class ProtocoloFichaComponent implements OnDestroy {
  private readonly service = inject(ProtocoloService);
  private readonly route = inject(ActivatedRoute);
  private intervalo: ReturnType<typeof setInterval> | null = null;
  private videoUrlAtual: string | null = null;

  readonly id = Number(this.route.snapshot.paramMap.get('id'));
  readonly modulos = PROTO_MODULOS;
  readonly camposEdicao = PROTO_CAMPOS_EDICAO;

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly salvo = signal(false);
  readonly processando = signal(false);
  readonly decidindo = signal(false);

  readonly protocolo = signal<Protocolo | null>(null);
  readonly podeAprovar = signal(false);
  readonly ehAudio = signal(false);
  readonly videoUrl = signal<string | null>(null);

  readonly pct = signal<number | null>(null);
  readonly pos = signal(0);
  readonly dur = signal(0);

  readonly edicao = signal<Record<string, string>>({});

  readonly etapas = computed<EtapaTimeline[]>(() => {
    const p = this.protocolo();
    if (!p) return [];
    const idx = IDX_POR_STATUS[p.status] ?? 0;
    return ETAPAS.map((nome, i) => {
      let classe: EtapaTimeline['classe'] = '';
      if (idx === -1 && i <= 2 && nome !== 'Recebido') classe = 'erro';
      else if (idx > i || (idx === 4 && i === 4)) classe = 'feita';
      else if (idx === i) classe = 'ativa';
      return { nome, numero: i + 1, classe, linhaFeita: idx > i };
    });
  });

  readonly detalheEtapa = computed<string>(() => {
    const p = this.protocolo();
    if (!p) return '';
    switch (p.status) {
      case 'Pendente':
        return 'Aguardando o processamento iniciar…';
      case 'Transcrevendo':
        return 'Transcrevendo o áudio do vídeo…';
      case 'Analisando':
        return 'IA organizando o protocolo (módulo, menu, passo a passo)…';
      case 'Em revisão':
        return 'Pronto! Revise os campos abaixo e aprove.';
      case 'Aprovado':
        return 'Publicado na base de conhecimento.';
      case 'Reprovado / Ajustar':
        return 'Devolvido para ajuste — edite e reprocesse ou aprove.';
      case 'Erro':
        return 'O processamento falhou — veja o erro acima e use “Processar agora”.';
      default:
        return '';
    }
  });

  readonly mostrarBarra = computed(() => this.protocolo()?.status === 'Transcrevendo' && this.pct() !== null);
  readonly barraTexto = computed(() => {
    const dur = this.dur();
    return `${this.pct()}% transcrito${dur ? ` — ${fmt(this.pos())} de ${fmt(dur)}` : ''}`;
  });

  constructor() {
    void this.carregar();
  }

  ngOnDestroy(): void {
    if (this.intervalo) clearInterval(this.intervalo);
    if (this.videoUrlAtual) URL.revokeObjectURL(this.videoUrlAtual);
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.ficha(this.id);
      this.protocolo.set(r.protocolo);
      this.podeAprovar.set(r.podeAprovar);
      this.ehAudio.set(r.ehAudio);
      this.edicao.set({
        titulo: r.protocolo.titulo,
        modulo: r.protocolo.modulo,
        menu: r.protocolo.menu,
        assunto: r.protocolo.assunto,
        ...Object.fromEntries(this.camposEdicao.map((c) => [c.chave, r.protocolo[c.chave]])),
      });
      if (!this.videoUrlAtual) void this.carregarVideo();
      this.configurarPolling(r.protocolo.status);
    } catch {
      this.erro.set('Não foi possível carregar o protocolo.');
    } finally {
      this.carregando.set(false);
    }
  }

  private async carregarVideo(): Promise<void> {
    try {
      const blob = await this.service.video(this.id);
      const url = URL.createObjectURL(blob);
      this.videoUrlAtual = url;
      this.videoUrl.set(url);
    } catch {
      // player fica vazio — o vídeo pode ter sido movido/removido do disco.
    }
  }

  private configurarPolling(status: StatusProtocolo): void {
    if (this.intervalo) {
      clearInterval(this.intervalo);
      this.intervalo = null;
    }
    if (!EM_ANDAMENTO.includes(status)) return;
    this.intervalo = setInterval(() => void this.tick(status), 4000);
  }

  private async tick(statusExibido: StatusProtocolo): Promise<void> {
    try {
      const j = await this.service.status(this.id);
      if (j.status !== statusExibido) {
        await this.carregar();
        return;
      }
      if (j.status === 'Transcrevendo' && j.pct !== null) {
        this.pct.set(j.pct);
        this.pos.set(j.pos);
        this.dur.set(j.dur);
      }
    } catch {
      // próxima batida tenta de novo.
    }
  }

  campo(chave: string): string {
    return this.edicao()[chave] ?? '';
  }

  onCampoChange(chave: string, valor: string): void {
    this.edicao.set({ ...this.edicao(), [chave]: valor });
    this.salvo.set(false);
  }

  async processar(): Promise<void> {
    if (!confirm('Reprocessar? A análise da IA será refeita (a edição manual será sobrescrita). A transcrição já feita é aproveitada — não transcreve de novo.')) {
      return;
    }
    this.processando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.processar(this.id);
      this.aviso.set(r.aviso);
      await this.carregar();
    } catch {
      this.erro.set('Não foi possível iniciar o processamento.');
    } finally {
      this.processando.set(false);
    }
  }

  async aprovar(): Promise<void> {
    this.decidindo.set(true);
    this.erro.set(null);
    try {
      await this.service.aprovar(this.id);
      await this.carregar();
    } catch {
      this.erro.set('Não foi possível aprovar.');
    } finally {
      this.decidindo.set(false);
    }
  }

  async reprovar(): Promise<void> {
    this.decidindo.set(true);
    this.erro.set(null);
    try {
      await this.service.reprovar(this.id);
      await this.carregar();
    } catch {
      this.erro.set('Não foi possível reprovar.');
    } finally {
      this.decidindo.set(false);
    }
  }

  async salvar(): Promise<void> {
    this.erro.set(null);
    try {
      const campos: Partial<Record<CampoTextoProtocolo, string>> = {
        titulo: this.campo('titulo'),
        modulo: this.campo('modulo'),
        menu: this.campo('menu'),
        assunto: this.campo('assunto'),
      };
      for (const c of this.camposEdicao) campos[c.chave] = this.campo(c.chave);
      await this.service.salvar(this.id, campos);
      this.salvo.set(true);
      await this.carregar();
    } catch {
      this.erro.set('Não foi possível salvar a edição.');
    }
  }

  formatarDataHora(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()} ${hh}:${min}`;
  }

  formatarData(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  formatarDuracao(seg: number): string {
    if (!seg) return '';
    const m = Math.floor(seg / 60);
    const s = String(seg % 60).padStart(2, '0');
    return `${m}:${s}`;
  }
}
