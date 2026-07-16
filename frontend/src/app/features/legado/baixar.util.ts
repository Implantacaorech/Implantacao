import { ArquivoBaixavel } from '../../core/models/legado.model';
import { LegadoService } from '../../core/services/legado.service';

export async function baixarArquivoLegado(service: LegadoService, arquivo: ArquivoBaixavel): Promise<void> {
  const { blob, filename } = await service.baixar(arquivo.token, arquivo.nome);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
