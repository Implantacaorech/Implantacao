import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProtocoloService } from '../../core/services/protocolo.service';
import {
  CampoTextoProtocolo,
  PROTO_CAMPOS_EDICAO,
  PROTO_MODULOS,
  Protocolo,
  ROTULO_ORIGEM,
  StatusProtocolo,
  VideoOrigem,
} from '../../core/models/protocolo.model';

const ETAPAS = ['Recebido', 'Transcrição', 'Análise IA', 'Em revisão', 'Aprovado'];

const IDX_POR_STATUS: Record<StatusProtocolo, number> = {
  // A reunião ainda está sendo gravada (transcrição ao vivo em curso, na tela de gravação):
  // do ponto de vista da linha do tempo, o material ainda nem chegou por completo.
  Gravando: 0,
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
  private readonly router = inject(Router);
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
  readonly podeExcluir = signal(false);
  readonly excluindo = signal(false);
  readonly ehAudio = signal(false);
  readonly videoUrl = signal<string | null>(null);

  /** Estado do player: só o tempo de pedir o ticket de mídia (uma chamada curta). O vídeo
   * em si é transmitido pelo próprio player, sob demanda — não se baixa mais o arquivo
   * inteiro para começar a assistir. */
  readonly midiaCarregando = signal(false);
  /** 'ver' = player de vídeo · 'escutar' = só o áudio. Arquivo de áudio só tem 'escutar'. */
  readonly modoMidia = signal<'ver' | 'escutar'>('ver');

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
      case 'Gravando':
        return 'Reunião em gravação — a transcrição ao vivo aparece na tela de gravação.';
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
    // Não há mais blob para revogar: a mídia agora é transmitida direto do servidor
    // (streaming com Range), então não fica nada preso na memória do navegador.
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      const r = await this.service.ficha(this.id);
      this.protocolo.set(r.protocolo);
      this.podeAprovar.set(r.podeAprovar);
      this.podeExcluir.set(r.podeExcluir);
      this.ehAudio.set(r.ehAudio);
      if (r.ehAudio) this.modoMidia.set('escutar');
      this.edicao.set({
        titulo: r.protocolo.titulo,
        modulo: r.protocolo.modulo,
        menu: r.protocolo.menu,
        assunto: r.protocolo.assunto,
        resumoCompleto: r.protocolo.resumoCompleto,
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

  /** Pede o ticket e monta a URL de streaming do player. Serve tanto o botão "Tentar de
   * novo" quanto a carga automática ao abrir a ficha. */
  async carregarVideo(): Promise<void> {
    if (this.midiaCarregando()) return;
    this.midiaCarregando.set(true);
    try {
      const url = await this.service.videoUrl(this.id);
      this.videoUrlAtual = url;
      this.videoUrl.set(url);
    } catch {
      // O arquivo pode ter sido movido/removido do disco — a tela avisa e oferece retry
      // (sem URL e sem carregamento em curso, o template mostra o bloco de erro).
    } finally {
      this.midiaCarregando.set(false);
    }
  }

  /** Alterna entre assistir (vídeo) e só escutar (áudio) — mesma URL de streaming. */
  verMidia(modo: 'ver' | 'escutar'): void {
    if (this.ehAudio()) return; // arquivo de áudio não tem imagem para assistir
    this.modoMidia.set(modo);
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
        resumoCompleto: this.campo('resumoCompleto'),
      };
      for (const c of this.camposEdicao) campos[c.chave] = this.campo(c.chave);
      await this.service.salvar(this.id, campos);
      this.salvo.set(true);
      await this.carregar();
    } catch {
      this.erro.set('Não foi possível salvar a edição.');
    }
  }

  async excluir(): Promise<void> {
    const p = this.protocolo();
    if (!p) return;
    if (
      !confirm(
        `Excluir definitivamente "${p.titulo || p.videoNome}"? O registro e o arquivo de vídeo/áudio original serão apagados — não é possível desfazer.`,
      )
    ) {
      return;
    }
    this.excluindo.set(true);
    this.erro.set(null);
    try {
      await this.service.excluir(this.id);
      await this.router.navigateByUrl('/protocolos');
    } catch {
      this.erro.set('Não foi possível excluir o protocolo.');
      this.excluindo.set(false);
    }
  }

  rotuloOrigem(origem: VideoOrigem): string {
    return ROTULO_ORIGEM[origem] ?? origem;
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
