import { PartialType } from '@nestjs/swagger';
import { CreateUsuarioDto } from './create-usuario.dto';

// PartialType já torna todo campo opcional preservando os demais validadores — `senha`
// enviada em branco/ausente NÃO altera a senha atual (mesmo contrato de
// webapp/app.py:usuarios).
export class UpdateUsuarioDto extends PartialType(CreateUsuarioDto) {}
